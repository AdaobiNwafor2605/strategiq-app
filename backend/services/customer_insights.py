"""
Customer-level aggregation, behavioural flags, recommended actions, and
weekly action summary. No protected files touched — standalone service.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

_PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


# ── Zero-safe division (mirrors safe_divide in main.py — not imported to avoid
#    circular imports from the shared module) ───────────────────────────────────
def _safe_div(num, den, default: float = 0.0) -> float:
    try:
        if den == 0 or pd.isna(den):
            return default
        result = float(num) / float(den)
        return default if (np.isnan(result) or np.isinf(result)) else result
    except Exception:
        return default


# ── Public entry point ────────────────────────────────────────────────────────

def build_customer_insights(
    df: pd.DataFrame,
    cust_col: str,
) -> Tuple[pd.DataFrame, int]:
    """
    Aggregate order-level DataFrame into one row per customer.

    Returns:
        (customer_df, skipped_count)
        skipped_count = rows dropped because cust_col was blank/null.
    """
    # INPUT VALIDATION: skip rows missing a customer identifier
    missing_mask = df[cust_col].isna() | (df[cust_col].astype(str).str.strip() == "")
    skipped = int(missing_mask.sum())
    if skipped:
        logger.info("customer_insights: skipped %d rows with blank %s", skipped, cust_col)
    df = df[~missing_mask].copy()

    if df.empty:
        return pd.DataFrame(), skipped

    today = pd.Timestamp.now().normalize()

    # ── Column availability flags ─────────────────────────────────────────────
    has_date = "order_date" in df.columns
    has_total = "total" in df.columns
    has_order_id = "order_id" in df.columns
    has_qty = "quantity" in df.columns
    has_product = "product_name" in df.columns
    has_discount = "discount_amount" in df.columns
    has_refund = "refund_amount" in df.columns

    if has_date:
        df["order_date"] = pd.to_datetime(df["order_date"], errors="coerce")

    # ── Pre-compute per-row helper columns ───────────────────────────────────
    if has_discount:
        df["_is_discounted"] = (
            pd.to_numeric(df["discount_amount"], errors="coerce").fillna(0) > 0
        ).astype(int)
    if has_refund:
        df["_refund"] = pd.to_numeric(df["refund_amount"], errors="coerce").fillna(0)

    # ── Core groupby aggregation ──────────────────────────────────────────────
    agg_spec: Dict = {}
    if has_total:
        agg_spec["total_revenue"] = pd.NamedAgg("total", "sum")
    if has_order_id:
        agg_spec["order_count"] = pd.NamedAgg("order_id", "nunique")
    elif has_total:
        agg_spec["order_count"] = pd.NamedAgg("total", "count")
    if has_date:
        agg_spec["first_order_date"] = pd.NamedAgg("order_date", "min")
        agg_spec["last_order_date"] = pd.NamedAgg("order_date", "max")
    if has_qty:
        agg_spec["total_quantity_purchased"] = pd.NamedAgg("quantity", "sum")
    if has_product:
        agg_spec["distinct_products_purchased"] = pd.NamedAgg("product_name", "nunique")
    if has_discount:
        agg_spec["total_discount_amount"] = pd.NamedAgg("discount_amount", "sum")
        agg_spec["_discounted_orders"] = pd.NamedAgg("_is_discounted", "sum")
    if has_refund:
        agg_spec["refund_total"] = pd.NamedAgg("_refund", "sum")

    customer_df = df.groupby(cust_col, as_index=False).agg(**agg_spec)

    # ── Defaults for absent columns ───────────────────────────────────────────
    if "total_revenue" not in customer_df.columns:
        customer_df["total_revenue"] = 0.0
    if "order_count" not in customer_df.columns:
        customer_df["order_count"] = 1

    # ── Derived core fields ───────────────────────────────────────────────────
    customer_df["aov"] = customer_df.apply(
        lambda r: _safe_div(r["total_revenue"], r["order_count"]), axis=1
    )

    if has_date:
        customer_df["first_order_date"] = pd.to_datetime(
            customer_df["first_order_date"], errors="coerce"
        )
        customer_df["last_order_date"] = pd.to_datetime(
            customer_df["last_order_date"], errors="coerce"
        )
        customer_df["days_since_last_order"] = (
            (today - customer_df["last_order_date"]).dt.days.fillna(-1).astype(int)
        )
        customer_df["customer_lifetime_days"] = (
            (customer_df["last_order_date"] - customer_df["first_order_date"])
            .dt.days.fillna(0)
            .astype(int)
        )
        # purchase_frequency: orders per 30-day period over lifetime
        customer_df["purchase_frequency"] = customer_df.apply(
            lambda r: _safe_div(
                r["order_count"],
                max(r["customer_lifetime_days"], 1) / 30.0,
            ),
            axis=1,
        )
    else:
        for col in ("days_since_last_order", "customer_lifetime_days"):
            customer_df[col] = -1
        customer_df["purchase_frequency"] = 0.0

    # discount_usage_rate
    if has_discount:
        customer_df["discount_usage_rate"] = customer_df.apply(
            lambda r: _safe_div(r["_discounted_orders"], r["order_count"]), axis=1
        )
        customer_df.drop(columns=["_discounted_orders"], inplace=True)
    else:
        customer_df["total_discount_amount"] = 0.0
        customer_df["discount_usage_rate"] = 0.0

    # refund_total, net_revenue
    if has_refund:
        customer_df["net_revenue"] = (
            customer_df["total_revenue"] - customer_df["refund_total"]
        )
    else:
        customer_df["refund_total"] = 0.0
        customer_df["net_revenue"] = customer_df["total_revenue"]

    # avg_days_between_orders
    if has_date and has_order_id:
        avg_days = _avg_days_between_orders(df, cust_col)
        customer_df = customer_df.merge(avg_days, on=cust_col, how="left")
        customer_df["avg_days_between_orders"] = (
            customer_df["avg_days_between_orders"].fillna(-1)
        )
    else:
        customer_df["avg_days_between_orders"] = -1.0

    # first_product_purchased, most_bought_product
    if has_product:
        first_prod, most_prod = _product_fields(df, cust_col, has_date)
        customer_df = customer_df.merge(first_prod, on=cust_col, how="left")
        customer_df = customer_df.merge(most_prod, on=cust_col, how="left")
    else:
        customer_df["first_product_purchased"] = None
        customer_df["most_bought_product"] = None

    # ── Behavioural flags ────────────────────────────────────────────────────
    revenue_top20 = customer_df["total_revenue"].quantile(0.80) if len(customer_df) >= 5 else 0.0

    customer_df["is_repeat_customer"] = customer_df["order_count"] >= 2
    customer_df["is_one_time_buyer"] = customer_df["order_count"] == 1
    customer_df["is_lapsed"] = customer_df["days_since_last_order"] >= 180
    customer_df["is_discount_dependent"] = customer_df["discount_usage_rate"] > 0.70
    customer_df["is_full_price_loyal"] = (
        (customer_df["order_count"] >= 2) & (customer_df["discount_usage_rate"] == 0)
    )
    customer_df["is_high_value"] = customer_df["total_revenue"] >= revenue_top20
    customer_df["is_new_customer"] = (
        (customer_df["days_since_last_order"] >= 0)
        & (customer_df["days_since_last_order"] <= 30)
    )
    customer_df["is_at_risk"] = customer_df.apply(_flag_at_risk, axis=1)
    if has_refund:
        customer_df["is_high_return_risk"] = customer_df.apply(
            lambda r: _safe_div(r["refund_total"], r["total_revenue"]) > 0.30, axis=1
        )
    else:
        customer_df["is_high_return_risk"] = False

    # ── Recommended action ────────────────────────────────────────────────────
    actions = customer_df.apply(_assign_action, axis=1, result_type="expand")
    customer_df[["recommended_action", "action_reason", "action_priority"]] = actions

    return customer_df, skipped


_SEGMENT_COLORS: Dict[str, str] = {
    "VIPs": "#8b5cf6",
    "Regulars": "#10b981",
    "New Customers": "#3b82f6",
    "One-Time Buyers": "#f59e0b",
    "Going Quiet": "#f97316",
    "Lapsed": "#ef4444",
    "Discount Shoppers": "#6366f1",
}


def _assign_segment(row) -> str:
    """Assign a customer to a segment — first match wins."""
    if row.get("is_lapsed"):
        return "Lapsed"
    if row.get("is_high_value") and row.get("is_full_price_loyal"):
        return "VIPs"
    if row.get("is_at_risk"):
        return "Going Quiet"
    if row.get("is_new_customer"):
        return "New Customers"
    if row.get("is_one_time_buyer"):
        return "One-Time Buyers"
    if row.get("is_discount_dependent"):
        return "Discount Shoppers"
    return "Regulars"


def compute_segments(customer_df: pd.DataFrame) -> List[Dict]:
    """
    Group customers into named segments based on behavioural flags.
    Returns a list of segment dicts sorted by total revenue descending.
    """
    if customer_df.empty:
        return []

    df = customer_df.copy()
    df["_segment"] = df.apply(_assign_segment, axis=1)

    grp = (
        df.groupby("_segment")
        .agg(
            customers=("_segment", "count"),
            total_revenue=("total_revenue", "sum"),
            avg_revenue=("total_revenue", "mean"),
        )
        .reset_index()
        .sort_values("total_revenue", ascending=False)
    )

    return [
        {
            "name": row["_segment"],
            "customers": int(row["customers"]),
            "total_revenue": round(float(row["total_revenue"]), 2),
            "avg_revenue": round(float(row["avg_revenue"]), 2),
            "color": _SEGMENT_COLORS.get(row["_segment"], "#94a3b8"),
        }
        for _, row in grp.iterrows()
    ]


def build_weekly_summary(customer_df: pd.DataFrame) -> Dict:
    """
    Group customers by recommended_action.
    Returns a summary dict sorted by priority (high first), then count.
    """
    if customer_df.empty or "recommended_action" not in customer_df.columns:
        return {"generated_at": datetime.utcnow().isoformat(), "groups": []}

    grp = (
        customer_df.groupby(["recommended_action", "action_priority"])
        .agg(
            customer_count=("recommended_action", "count"),
            total_revenue_at_stake=("total_revenue", "sum"),
        )
        .reset_index()
    )
    grp["_p"] = grp["action_priority"].map(_PRIORITY_ORDER).fillna(3)
    grp = grp.sort_values(["_p", "customer_count"], ascending=[True, False]).drop(
        columns=["_p"]
    )

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "groups": [
            {
                "action": row["recommended_action"],
                "action_priority": row["action_priority"],
                "customer_count": int(row["customer_count"]),
                "total_revenue_at_stake": round(float(row["total_revenue_at_stake"]), 2),
            }
            for _, row in grp.iterrows()
        ],
    }


# ── Internal helpers ──────────────────────────────────────────────────────────

def _avg_days_between_orders(df: pd.DataFrame, cust_col: str) -> pd.DataFrame:
    """Per-customer average gap between consecutive order dates."""
    try:
        order_dates = (
            df.dropna(subset=["order_date"])
            .groupby(cust_col)["order_date"]
            .apply(lambda s: sorted(s.dropna().unique()))
            .reset_index()
        )

        def _gap(dates: list) -> float:
            if len(dates) < 2:
                return -1.0
            gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
            return float(np.mean(gaps)) if gaps else -1.0

        order_dates["avg_days_between_orders"] = order_dates["order_date"].apply(_gap)
        return order_dates[[cust_col, "avg_days_between_orders"]]
    except Exception as exc:
        logger.warning("avg_days_between_orders failed: %s", exc)
        return pd.DataFrame(columns=[cust_col, "avg_days_between_orders"])


def _product_fields(
    df: pd.DataFrame, cust_col: str, has_date: bool
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Return (first_product_df, most_bought_product_df)."""
    try:
        if has_date:
            first_prod = (
                df.dropna(subset=["order_date", "product_name"])
                .sort_values("order_date")
                .groupby(cust_col)["product_name"]
                .first()
                .reset_index()
                .rename(columns={"product_name": "first_product_purchased"})
            )
        else:
            first_prod = (
                df.dropna(subset=["product_name"])
                .groupby(cust_col)["product_name"]
                .first()
                .reset_index()
                .rename(columns={"product_name": "first_product_purchased"})
            )

        most_prod = (
            df.dropna(subset=["product_name"])
            .groupby([cust_col, "product_name"])
            .size()
            .reset_index(name="_cnt")
            .sort_values("_cnt", ascending=False)
            .groupby(cust_col)
            .first()
            .reset_index()[[cust_col, "product_name"]]
            .rename(columns={"product_name": "most_bought_product"})
        )
        return first_prod, most_prod
    except Exception as exc:
        logger.warning("product fields failed: %s", exc)
        empty: pd.DataFrame = pd.DataFrame(columns=[cust_col])
        return empty, empty


def _flag_at_risk(row) -> bool:
    """is_at_risk: days_since > 2× avg_days_between (repeat customers only)."""
    if not row.get("is_repeat_customer", False):
        return False
    avg = row.get("avg_days_between_orders", -1)
    dslo = row.get("days_since_last_order", -1)
    if avg <= 0 or dslo < 0:
        return False
    return dslo > 2 * avg


def _assign_action(row) -> Tuple[str, str, str]:
    """Rule-based action assignment. Returns (action, reason, priority)."""
    dslo = int(row.get("days_since_last_order", -1))
    count = int(row.get("order_count", 0))
    disc_pct = int(round(row.get("discount_usage_rate", 0) * 100))

    if row.get("is_lapsed") and row.get("is_high_value"):
        return (
            "Personal re-engagement — call, don't email",
            f"No purchase in {dslo} days and in top 20% by revenue. High-value lapsed customers need a personal touch.",
            "high",
        )
    if row.get("is_at_risk") and row.get("is_high_value"):
        return (
            "Send win-back email — offer genuine incentive",
            f"Last order {dslo} days ago — more than 2× their usual gap. High value. Act before they lapse.",
            "high",
        )
    if row.get("is_full_price_loyal"):
        return (
            "Add to VIP audience — no discount needed",
            f"{count} orders at full price, zero discounts used. Protect margin — keep them off discount lists.",
            "medium",
        )
    if row.get("is_new_customer"):
        return (
            "Send onboarding sequence",
            f"First purchase {dslo} days ago. Early nurture is critical for long-term retention.",
            "medium",
        )
    if row.get("is_one_time_buyer") and 30 <= dslo <= 60:
        return (
            "Send second-purchase nudge",
            f"One purchase {dslo} days ago — the 30–60 day window is the best time to convert to repeat buyer.",
            "medium",
        )
    if row.get("is_discount_dependent"):
        return (
            "Test at full price — may buy anyway",
            f"{disc_pct}% of orders used a discount. Worth testing removal — they may buy regardless.",
            "low",
        )
    return (
        "Monitor — no immediate action",
        "No strong behavioural signal. Keep in regular communications.",
        "low",
    )

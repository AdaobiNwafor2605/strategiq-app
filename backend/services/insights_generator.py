"""
Full insight bank generator.
Called from upload_v2._run_insights_pipeline after customer_df is built.
Generates 7+ categorised, scored insights from customer-level behavioural data.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)

# ── Scoring weights ──────────────────────────────────────────────────────────
_CONF_SCORE = {"high": 1.0, "medium": 0.7, "low": 0.4}
_ACTION_SCORE = {"immediately": 1.0, "this week": 1.0, "this month": 0.7, "next campaign": 0.5, "ongoing": 0.3}

# ── Benchmark definitions per segment ────────────────────────────────────────
SEGMENT_BENCHMARKS: Dict[str, Dict[str, Any]] = {
    "VIPs": {
        "description": "Your highest-value, full-price loyal buyers.",
        "why": "They generate the most revenue and buy without needing a discount — protecting them from promotion lists preserves your margins.",
        "how_to_treat": "Reward with exclusivity (early access, personal notes) — never with discounts.",
        "typical_pct": "5–10% of customers, 25–40% of revenue",
        "benchmark_note": "Healthy brands see VIPs at 5–10% of base. Below 5%? Focus on converting Regulars up.",
    },
    "Regulars": {
        "description": "Repeat buyers who purchase at a steady pace.",
        "why": "These customers drive the backbone of your recurring revenue and are most likely to refer others.",
        "how_to_treat": "Stay top of mind with consistent communication. Personalise by most-bought product.",
        "typical_pct": "15–25% of customers, 30–40% of revenue",
        "benchmark_note": "If Regulars are under 15%, your second-purchase conversion needs work.",
    },
    "New Customers": {
        "description": "First-time buyers in the last 30 days.",
        "why": "The 30-day post-purchase window is the highest-leverage retention moment. Most churn happens here.",
        "how_to_treat": "Send an onboarding sequence (3–4 emails, not automated welcome spam). Make them feel noticed.",
        "typical_pct": "10–20% per month in a growing brand",
        "benchmark_note": "New customers should be turning into Regulars within 60 days — if not, check your onboarding.",
    },
    "One-Time Buyers": {
        "description": "Customers who bought exactly once.",
        "why": "60–80% of first-time buyers never return without a specific nudge. This is your biggest revenue leak.",
        "how_to_treat": "Send a second-purchase nudge at 30–45 days. Use the product they bought to personalise.",
        "typical_pct": "30–50% of total base — should shrink over time",
        "benchmark_note": "If One-Time Buyers exceed 50% of your base, your retention is your #1 problem.",
    },
    "Going Quiet": {
        "description": "Repeat buyers who are overdue by their own standards.",
        "why": "They've shown they can buy again — they just haven't. Targeted re-engagement recovers 10–20% of this group.",
        "how_to_treat": "Personal re-engagement email referencing their last product. Not a batch discount blast.",
        "typical_pct": "5–15% of customers",
        "benchmark_note": "Going Quiet above 15%? Your email frequency or relevance may be slipping.",
    },
    "Lapsed": {
        "description": "Customers with no purchase in 180+ days.",
        "why": "Still worth trying — the cost to win back a lapsed customer is 5× cheaper than acquiring a new one.",
        "how_to_treat": "One targeted win-back attempt, then move them to a low-frequency list. Don't spam.",
        "typical_pct": "Under 15% is healthy — above 25% signals a retention emergency",
        "benchmark_note": "Lapsed above 20% means your brand is not keeping customers engaged past a single season.",
    },
    "Discount Shoppers": {
        "description": "Buyers who used a discount on 70%+ of their orders.",
        "why": "Discount-dependent customers squeeze margin and anchor to sale prices — over time they only buy on promotion.",
        "how_to_treat": "Test removing them from the next promotion. Some will buy anyway. The ones who don't — that's their true LTV.",
        "typical_pct": "Under 15% is healthy",
        "benchmark_note": "If Discount Shoppers are above 20%, check whether your promotions are training buyers to wait.",
    },
}


def generate_insight_bank(
    customer_df: pd.DataFrame,
    cust_col: str,
    total_revenue: float,
) -> List[Dict]:
    """
    Generate a scored, ranked list of insights from the customer DataFrame.
    Returns insights sorted by score descending (best first).
    """
    if customer_df.empty or total_revenue <= 0:
        return []

    insights: List[Dict] = []

    insights.extend(_retention_risk_insights(customer_df, cust_col, total_revenue))
    insights.extend(_growth_opportunity_insights(customer_df, cust_col, total_revenue))
    insights.extend(_discount_insights(customer_df, cust_col, total_revenue))
    insights.extend(_cohort_quality_insights(customer_df, cust_col, total_revenue))
    insights.extend(_customer_concentration_insights(customer_df, cust_col, total_revenue))
    insights.extend(_product_concentration_insights(customer_df, cust_col, total_revenue))
    insights.extend(_seasonality_insights(customer_df, cust_col, total_revenue))

    # Sort by score descending
    insights.sort(key=lambda x: x["score"], reverse=True)

    return insights


# ── Category: Retention Risk ─────────────────────────────────────────────────

def _retention_risk_insights(df: pd.DataFrame, cust_col: str, total_rev: float) -> List[Dict]:
    out = []

    # Lapsed high-value customers
    mask_lhv = df.get("is_lapsed", pd.Series(False, index=df.index)) & \
                df.get("is_high_value", pd.Series(False, index=df.index))
    lhv = df[mask_lhv]
    if not lhv.empty:
        rev = float(lhv["total_revenue"].sum()) if "total_revenue" in lhv.columns else 0.0
        out.append(_make_insight(
            id="retention-lapsed-high-value",
            category="retention_risk",
            headline=f"High-value customers have gone cold — {len(lhv)} lapsed buyers",
            explanation=(
                f"{len(lhv)} of your most valuable customers haven't purchased in 180+ days. "
                "These aren't cold leads — they're people who already chose your brand. "
                "A personal outreach (not a broadcast email) is the highest-ROI move here."
            ),
            revenue_at_stake=rev,
            affected_count=len(lhv),
            confidence=_confidence(len(lhv)),
            suggested_action="Send a personal re-engagement message referencing their last purchase. No discount — just a check-in.",
            flag_citations=["is_lapsed", "is_high_value"],
            data_logic=(
                f"Identified {len(lhv)} customers with is_lapsed=True (last order ≥ 180 days ago) "
                f"AND is_high_value=True (revenue in top 20% of base). "
                f"Combined revenue at stake: £{rev:,.0f}."
            ),
            customer_keys=_keys(lhv, cust_col),
            total_rev=total_rev,
            timing="immediately",
        ))

    # At-risk high-value customers (going quiet but not yet lapsed)
    mask_arv = df.get("is_at_risk", pd.Series(False, index=df.index)) & \
                df.get("is_high_value", pd.Series(False, index=df.index)) & \
                ~df.get("is_lapsed", pd.Series(False, index=df.index))
    arv = df[mask_arv]
    if not arv.empty:
        rev = float(arv["total_revenue"].sum()) if "total_revenue" in arv.columns else 0.0
        out.append(_make_insight(
            id="retention-at-risk-high-value",
            category="retention_risk",
            headline=f"Win-back window open — {len(arv)} valuable buyers overdue",
            explanation=(
                f"{len(arv)} customers who spend above average have gone past 2× their usual buying gap. "
                "They're not gone yet, but they're cooling. "
                "A targeted email this week — before they tip into lapsed — is your best recovery chance."
            ),
            revenue_at_stake=rev,
            affected_count=len(arv),
            confidence=_confidence(len(arv)),
            suggested_action="Send a win-back email referencing their last product. Offer a genuine incentive — not a blanket 10% off.",
            flag_citations=["is_at_risk", "is_high_value"],
            data_logic=(
                f"Identified {len(arv)} customers with is_at_risk=True (days_since_last_order > 2 × avg_days_between_orders) "
                f"AND is_high_value=True. Excludes already-lapsed customers."
            ),
            customer_keys=_keys(arv, cust_col),
            total_rev=total_rev,
            timing="this week",
        ))

    # Overall churn exposure
    mask_lapsed = df.get("is_lapsed", pd.Series(False, index=df.index))
    lapsed_total = df[mask_lapsed]
    lapsed_pct = len(lapsed_total) / max(len(df), 1) * 100
    if lapsed_pct > 15 and len(lapsed_total) >= 5:
        rev = float(lapsed_total["total_revenue"].sum()) if "total_revenue" in lapsed_total.columns else 0.0
        out.append(_make_insight(
            id="retention-overall-lapse-rate",
            category="retention_risk",
            headline=f"{lapsed_pct:.0f}% of your customer base has lapsed — above healthy levels",
            explanation=(
                f"{len(lapsed_total)} of your {len(df)} customers haven't bought in 180+ days. "
                f"A healthy brand should keep this below 15%. Yours is at {lapsed_pct:.0f}%. "
                "This is a systemic retention problem, not just individual customer churn."
            ),
            revenue_at_stake=rev,
            affected_count=len(lapsed_total),
            confidence=_confidence(len(lapsed_total)),
            suggested_action="Segment lapsed customers by value — high-value get personal outreach, mid-value get a win-back sequence, low-value get a re-permission email.",
            flag_citations=["is_lapsed"],
            data_logic=(
                f"{len(lapsed_total)} customers flagged is_lapsed=True out of {len(df)} total. "
                f"Lapse rate: {lapsed_pct:.1f}%. Industry benchmark: <15%."
            ),
            customer_keys=_keys(lapsed_total, cust_col),
            total_rev=total_rev,
            timing="this month",
        ))

    return out


# ── Category: Growth Opportunity ─────────────────────────────────────────────

def _growth_opportunity_insights(df: pd.DataFrame, cust_col: str, total_rev: float) -> List[Dict]:
    out = []

    # One-time buyers in 30–60 day conversion window
    mask_otb = (
        df.get("is_one_time_buyer", pd.Series(False, index=df.index)) &
        (df.get("days_since_last_order", pd.Series(-1, index=df.index)) >= 30) &
        (df.get("days_since_last_order", pd.Series(-1, index=df.index)) <= 60)
    )
    otb_window = df[mask_otb]
    if not otb_window.empty:
        rev = float(otb_window["total_revenue"].sum()) if "total_revenue" in otb_window.columns else 0.0
        out.append(_make_insight(
            id="growth-first-to-second-window",
            category="growth_opportunity",
            headline=f"Conversion window closing — {len(otb_window)} one-time buyers need a nudge now",
            explanation=(
                f"{len(otb_window)} customers made their first purchase 30–60 days ago and haven't returned. "
                "This window is statistically the best time to convert them — after 60 days, the chances drop sharply. "
                "A single well-timed email referencing their purchase can double your conversion rate."
            ),
            revenue_at_stake=rev * 1.2,  # 1.2× as opportunity (they could buy again)
            affected_count=len(otb_window),
            confidence=_confidence(len(otb_window)),
            suggested_action="Send a second-purchase nudge referencing their first product. Include social proof or a bestseller recommendation.",
            flag_citations=["is_one_time_buyer", "days_since_last_order"],
            data_logic=(
                f"Customers with is_one_time_buyer=True and 30 ≤ days_since_last_order ≤ 60. "
                f"Count: {len(otb_window)}. Revenue if converted at same AOV: estimate £{rev * 0.9:,.0f}."
            ),
            customer_keys=_keys(otb_window, cust_col),
            total_rev=total_rev,
            timing="this week",
        ))

    # Full-price loyalists — protect and elevate
    mask_fpl = (
        df.get("is_full_price_loyal", pd.Series(False, index=df.index)) &
        df.get("is_repeat_customer", pd.Series(False, index=df.index))
    )
    fpl = df[mask_fpl]
    if not fpl.empty:
        rev = float(fpl["total_revenue"].sum()) if "total_revenue" in fpl.columns else 0.0
        fpl_pct = len(fpl) / max(len(df), 1) * 100
        out.append(_make_insight(
            id="growth-full-price-loyalists",
            category="growth_opportunity",
            headline=f"{len(fpl)} full-price loyalists — your highest-margin customers",
            explanation=(
                f"{len(fpl)} repeat customers have never used a discount ({fpl_pct:.0f}% of your base). "
                "These people buy at full price, repeatedly. They're your most margin-efficient customers. "
                "Putting them in a promotion list trains them to wait for sales — exclude them from every campaign."
            ),
            revenue_at_stake=rev,
            affected_count=len(fpl),
            confidence=_confidence(len(fpl)),
            suggested_action="Tag these customers and exclude them from ALL discount campaigns. Reward with exclusive access, not price cuts.",
            flag_citations=["is_full_price_loyal", "is_repeat_customer"],
            data_logic=(
                f"Customers with is_full_price_loyal=True (order_count ≥ 2 AND discount_usage_rate = 0). "
                f"Count: {len(fpl)} ({fpl_pct:.1f}% of base). Total revenue: £{rev:,.0f}."
            ),
            customer_keys=_keys(fpl, cust_col),
            total_rev=total_rev,
            timing="immediately",
        ))

    return out


# ── Category: Discount Inefficiency ─────────────────────────────────────────

def _discount_insights(df: pd.DataFrame, cust_col: str, total_rev: float) -> List[Dict]:
    out = []

    if "total_discount_amount" not in df.columns and "discount_usage_rate" not in df.columns:
        return out

    mask_dd = df.get("is_discount_dependent", pd.Series(False, index=df.index))
    dd = df[mask_dd]
    if dd.empty:
        return out

    total_discounts = float(dd.get("total_discount_amount", pd.Series(0.0)).sum())
    dd_pct = len(dd) / max(len(df), 1) * 100

    out.append(_make_insight(
        id="discount-dependency",
        category="discount_inefficiency",
        headline=f"{len(dd)} customers ({dd_pct:.0f}%) are discount-dependent — margin is leaking",
        explanation=(
            f"{len(dd)} customers used a discount on more than 70% of their orders. "
            f"You've given away £{total_discounts:,.0f} in discounts to this group. "
            "Some of them would buy at full price — you won't know until you test."
        ),
        revenue_at_stake=total_discounts,
        affected_count=len(dd),
        confidence=_confidence(len(dd)),
        suggested_action="Remove this group from your next promotion. Monitor: those who still buy are full-price convertibles. Those who don't — that's their real LTV.",
        flag_citations=["is_discount_dependent", "discount_usage_rate", "total_discount_amount"],
        data_logic=(
            f"Customers with discount_usage_rate > 0.70 (70%+ of orders used a discount). "
            f"Count: {len(dd)}. Total discounts given: £{total_discounts:,.0f}."
        ),
        customer_keys=_keys(dd, cust_col),
        total_rev=total_rev,
        timing="next campaign",
    ))

    return out


# ── Category: Cohort Quality ─────────────────────────────────────────────────

def _cohort_quality_insights(df: pd.DataFrame, cust_col: str, total_rev: float) -> List[Dict]:
    out = []

    total_customers = len(df)
    if total_customers < 5:
        return out

    # Repeat rate
    repeat_mask = df.get("is_repeat_customer", pd.Series(False, index=df.index))
    repeat_count = int(repeat_mask.sum())
    repeat_rate = repeat_count / total_customers * 100

    if repeat_rate < 30:
        rev_repeat = float(df[repeat_mask]["total_revenue"].sum()) if "total_revenue" in df.columns else 0.0
        out.append(_make_insight(
            id="cohort-low-repeat-rate",
            category="cohort_quality",
            headline=f"Only {repeat_rate:.0f}% of customers have bought more than once",
            explanation=(
                f"{repeat_count} of your {total_customers} customers have placed 2+ orders. "
                "A healthy brand should see 30–50% repeat rate. Yours is below that. "
                "Every customer you acquire but don't retain costs you twice — once to get them, once when they leave."
            ),
            revenue_at_stake=0.0,
            affected_count=total_customers - repeat_count,  # one-time buyers
            confidence="high" if total_customers >= 20 else "medium",
            suggested_action="Audit your post-purchase flow. If there's no automated second-purchase sequence, build one — it's the single highest-ROI retention tool.",
            flag_citations=["is_repeat_customer"],
            data_logic=(
                f"repeat_rate = {repeat_count} customers with order_count ≥ 2 / {total_customers} total = {repeat_rate:.1f}%. "
                f"Industry benchmark for healthy retention: 30–50%."
            ),
            customer_keys=[],
            total_rev=total_rev,
            timing="this month",
        ))

    # New customer pipeline quality
    new_mask = df.get("is_new_customer", pd.Series(False, index=df.index))
    new_customers = df[new_mask]
    if len(new_customers) >= 3 and "aov" in df.columns:
        new_aov = float(new_customers["aov"].mean())
        overall_aov = float(df["aov"].mean())
        if new_aov > overall_aov * 1.1:
            out.append(_make_insight(
                id="cohort-new-customer-quality",
                category="cohort_quality",
                headline=f"New customers are spending {((new_aov / overall_aov) - 1) * 100:.0f}% more than your average",
                explanation=(
                    f"Your {len(new_customers)} new customers (last 30 days) have an average order value of "
                    f"£{new_aov:.0f} vs your overall AOV of £{overall_aov:.0f}. "
                    "This is a quality signal — your current acquisition channels are bringing in higher-value buyers. "
                    "Double down on whatever is driving this."
                ),
                revenue_at_stake=float(new_customers["total_revenue"].sum()) if "total_revenue" in new_customers.columns else 0.0,
                affected_count=len(new_customers),
                confidence=_confidence(len(new_customers)),
                suggested_action="Identify which channel these new customers came from and increase spend there. Also: make sure your onboarding sequence treats them as high-value from day one.",
                flag_citations=["is_new_customer", "aov"],
                data_logic=(
                    f"New customer (is_new_customer=True) avg AOV: £{new_aov:.2f}. "
                    f"Overall AOV: £{overall_aov:.2f}. "
                    f"Delta: +{((new_aov / overall_aov) - 1) * 100:.1f}%."
                ),
                customer_keys=_keys(new_customers, cust_col),
                total_rev=total_rev,
                timing="immediately",
            ))

    return out


# ── Category: Customer Concentration ────────────────────────────────────────

def _customer_concentration_insights(df: pd.DataFrame, cust_col: str, total_rev: float) -> List[Dict]:
    out = []

    if "total_revenue" not in df.columns or len(df) < 10:
        return out

    df_sorted = df.sort_values("total_revenue", ascending=False)
    top_10_pct_n = max(1, len(df) // 10)
    top_customers = df_sorted.head(top_10_pct_n)
    top_rev = float(top_customers["total_revenue"].sum())
    top_rev_pct = top_rev / total_rev * 100

    if top_rev_pct > 50:
        out.append(_make_insight(
            id="concentration-top10pct",
            category="customer_concentration",
            headline=f"Top {top_10_pct_n} customers drive {top_rev_pct:.0f}% of your revenue — concentration risk",
            explanation=(
                f"Your top 10% of customers ({top_10_pct_n} people) account for {top_rev_pct:.0f}% of total revenue. "
                "This level of concentration means losing a handful of VIPs could materially hurt your business. "
                "It also means your mid-tier customers have significant untapped potential."
            ),
            revenue_at_stake=top_rev,
            affected_count=top_10_pct_n,
            confidence="high",
            suggested_action="Protect your top customers with a dedicated VIP program. Simultaneously, run second-purchase campaigns for your mid-tier to diversify your revenue base.",
            flag_citations=["total_revenue", "is_high_value"],
            data_logic=(
                f"Top {top_10_pct_n} customers by total_revenue (top 10%). "
                f"Their combined revenue: £{top_rev:,.0f} = {top_rev_pct:.1f}% of total £{total_rev:,.0f}."
            ),
            customer_keys=_keys(top_customers, cust_col),
            total_rev=total_rev,
            timing="this month",
        ))

    return out


# ── Category: Product Concentration ────────────────────────────────────────

def _product_concentration_insights(df: pd.DataFrame, cust_col: str, total_rev: float) -> List[Dict]:
    """Infer product concentration from per-customer most_bought_product field."""
    out = []

    if "most_bought_product" not in df.columns:
        return out

    product_counts = df["most_bought_product"].dropna().value_counts()
    if len(product_counts) < 2:
        return out

    top_product = product_counts.index[0]
    top_product_customers = int(product_counts.iloc[0])
    top_pct = top_product_customers / max(len(df), 1) * 100

    if top_pct > 40:
        # Estimate revenue for customers whose top product is this one
        top_mask = df["most_bought_product"] == top_product
        top_rev_est = float(df[top_mask]["total_revenue"].sum()) if "total_revenue" in df.columns else 0.0

        out.append(_make_insight(
            id="concentration-product",
            category="product_concentration",
            headline=f"'{top_product}' is the most-bought item for {top_pct:.0f}% of your customers",
            explanation=(
                f"{top_product_customers} of your customers ({top_pct:.0f}%) most frequently purchased '{top_product}'. "
                "This level of product concentration is a risk: if that product goes out of stock, changes pricing, "
                "or loses relevance, it could drive significant churn. It's also a cross-sell opportunity."
            ),
            revenue_at_stake=top_rev_est,
            affected_count=top_product_customers,
            confidence=_confidence(top_product_customers),
            suggested_action=f"Cross-sell complementary items to buyers of '{top_product}'. Also: make sure this product is always in stock and treated as your anchor product.",
            flag_citations=["most_bought_product"],
            data_logic=(
                f"{top_product_customers} customers have '{top_product}' as their most-bought product "
                f"({top_pct:.1f}% of base). Total revenue from this group: est. £{top_rev_est:,.0f}."
            ),
            customer_keys=_keys(df[top_mask], cust_col),
            total_rev=total_rev,
            timing="this month",
        ))

    return out


# ── Category: Seasonality ────────────────────────────────────────────────────

def _seasonality_insights(df: pd.DataFrame, cust_col: str, total_rev: float) -> List[Dict]:
    """Detect purchase concentration in specific months using last_order_date."""
    out = []

    if "last_order_date" not in df.columns or len(df) < 10:
        return out

    try:
        dates = pd.to_datetime(df["last_order_date"], errors="coerce").dropna()
        if len(dates) < 10:
            return out

        month_counts = dates.dt.month.value_counts()
        top_month_num = int(month_counts.index[0])
        top_month_count = int(month_counts.iloc[0])
        top_month_pct = top_month_count / len(dates) * 100

        _MONTH_NAMES = {
            1: "January", 2: "February", 3: "March", 4: "April",
            5: "May", 6: "June", 7: "July", 8: "August",
            9: "September", 10: "October", 11: "November", 12: "December",
        }
        top_month_name = _MONTH_NAMES.get(top_month_num, f"Month {top_month_num}")

        # Concentrated buying season (top month has >30% of last orders)
        if top_month_pct > 30:
            # Estimate revenue for these customers
            top_month_mask = pd.to_datetime(df["last_order_date"], errors="coerce").dt.month == top_month_num
            season_rev = float(df[top_month_mask]["total_revenue"].sum()) if "total_revenue" in df.columns else 0.0

            out.append(_make_insight(
                id="seasonality-peak-month",
                category="seasonality",
                headline=f"{top_month_name} is your biggest buying month — {top_month_pct:.0f}% of orders land then",
                explanation=(
                    f"{top_month_count} of your customers made their most recent purchase in {top_month_name} "
                    f"({top_month_pct:.0f}% of your active base). "
                    "This level of seasonal concentration means you're heavily dependent on one period — "
                    "revenue will dip sharply in other months unless you actively drive off-peak purchases."
                ),
                revenue_at_stake=season_rev,
                affected_count=top_month_count,
                confidence=_confidence(top_month_count),
                suggested_action=(
                    f"Build an off-peak campaign for the months immediately before and after {top_month_name}. "
                    "Consider a 'between seasons' product launch to flatten the revenue curve."
                ),
                flag_citations=["last_order_date"],
                data_logic=(
                    f"Distribution of last_order_date by month across {len(dates)} customers with dates. "
                    f"Top month: {top_month_name} with {top_month_count} customers ({top_month_pct:.1f}%)."
                ),
                customer_keys=_keys(df[top_month_mask], cust_col),
                total_rev=total_rev,
                timing="this month",
            ))
    except Exception as exc:
        logger.warning("seasonality_insights failed: %s", exc)

    return out


# ── Helpers ──────────────────────────────────────────────────────────────────

def _confidence(n: int) -> str:
    if n >= 10:
        return "high"
    if n >= 4:
        return "medium"
    return "low"


def _keys(df: pd.DataFrame, cust_col: str, limit: int = 200) -> List[str]:
    """Return up to `limit` customer key values (email or id) as strings."""
    if cust_col not in df.columns:
        return []
    return [str(v) for v in df[cust_col].dropna().head(limit).tolist()]


def _make_insight(
    *,
    id: str,
    category: str,
    headline: str,
    explanation: str,
    revenue_at_stake: float,
    affected_count: int,
    confidence: str,
    suggested_action: str,
    flag_citations: List[str],
    data_logic: str,
    customer_keys: List[str],
    total_rev: float,
    timing: str,
) -> Dict:
    revenue_share = min(revenue_at_stake / max(total_rev, 1), 1.0)
    act_score = _ACTION_SCORE.get(timing, 0.5)
    score = round(
        _CONF_SCORE.get(confidence, 0.4) * 40
        + revenue_share * 40
        + act_score * 20,
        2,
    )
    return {
        "id": id,
        "category": category,
        "headline": headline,
        "explanation": explanation,
        "revenue_at_stake": round(float(revenue_at_stake), 2),
        "affected_count": int(affected_count),
        "confidence": confidence,
        "suggested_action": suggested_action,
        "flag_citations": flag_citations,
        "data_logic": data_logic,
        "score": score,
        "customer_keys": customer_keys,
    }

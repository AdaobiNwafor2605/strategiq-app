"""
Build CustomerProfile instances from aggregated customer data.

Maps customer_insights DataFrame rows into structured profiles for the
decision engine. Lifecycle stage is derived from behavioural flags, not
from segment labels alone.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from services.recommendation_models import (
    BehaviourFlags,
    CustomerProfile,
    CustomerValue,
    DiscountBehaviour,
    LifecycleStage,
    PurchaseCadence,
    ReturnBehaviour,
)


def derive_lifecycle_stage(flags: BehaviourFlags) -> LifecycleStage:
    """Derive lifecycle stage from behavioural flags — first match wins."""
    if flags.is_lapsed:
        return LifecycleStage.LAPSED
    if flags.is_high_value and flags.is_full_price_loyal:
        return LifecycleStage.VIP
    if flags.is_at_risk:
        return LifecycleStage.GOING_QUIET
    if flags.is_new_customer:
        return LifecycleStage.NEW
    if flags.is_one_time_buyer:
        return LifecycleStage.ONE_TIME_BUYER
    if flags.is_discount_dependent:
        return LifecycleStage.DISCOUNT_SHOPPER
    return LifecycleStage.REGULAR


def _segment_label(stage: LifecycleStage) -> str:
    return {
        LifecycleStage.VIP: "VIPs",
        LifecycleStage.REGULAR: "Regulars",
        LifecycleStage.NEW: "New Customers",
        LifecycleStage.ONE_TIME_BUYER: "One-Time Buyers",
        LifecycleStage.GOING_QUIET: "Going Quiet",
        LifecycleStage.LAPSED: "Lapsed",
        LifecycleStage.DISCOUNT_SHOPPER: "Discount Shoppers",
    }[stage]


def build_customer_profile(
    customer_id: str,
    row: Dict[str, Any],
) -> CustomerProfile:
    """Build a CustomerProfile from a customer_insights row dict."""
    flags = BehaviourFlags(
        is_repeat_customer=bool(row.get("is_repeat_customer", False)),
        is_one_time_buyer=bool(row.get("is_one_time_buyer", False)),
        is_lapsed=bool(row.get("is_lapsed", False)),
        is_discount_dependent=bool(row.get("is_discount_dependent", False)),
        is_full_price_loyal=bool(row.get("is_full_price_loyal", False)),
        is_high_value=bool(row.get("is_high_value", False)),
        is_new_customer=bool(row.get("is_new_customer", False)),
        is_at_risk=bool(row.get("is_at_risk", False)),
        is_high_return_risk=bool(row.get("is_high_return_risk", False)),
    )
    lifecycle = derive_lifecycle_stage(flags)
    total_revenue = float(row.get("total_revenue", 0.0) or 0.0)
    refund_total = float(row.get("refund_total", 0.0) or 0.0)
    return_rate = refund_total / total_revenue if total_revenue > 0 else 0.0

    return CustomerProfile(
        customer_id=customer_id,
        lifecycle_stage=lifecycle,
        segment=_segment_label(lifecycle),
        behaviour_flags=flags,
        customer_value=CustomerValue(
            total_revenue=total_revenue,
            net_revenue=float(row.get("net_revenue", total_revenue) or total_revenue),
            aov=float(row.get("aov", 0.0) or 0.0),
        ),
        discount_behaviour=DiscountBehaviour(
            discount_usage_rate=float(row.get("discount_usage_rate", 0.0) or 0.0),
            total_discount_amount=float(row.get("total_discount_amount", 0.0) or 0.0),
        ),
        return_behaviour=ReturnBehaviour(
            refund_total=refund_total,
            return_rate=return_rate,
        ),
        purchase_cadence=PurchaseCadence(
            days_since_last_order=int(row.get("days_since_last_order", -1) or -1),
            avg_days_between_orders=float(row.get("avg_days_between_orders", -1.0) or -1.0),
            purchase_frequency=float(row.get("purchase_frequency", 0.0) or 0.0),
            order_count=int(row.get("order_count", 0) or 0),
        ),
        first_product_purchased=row.get("first_product_purchased"),
        most_bought_product=row.get("most_bought_product"),
        metadata={
            "distinct_products_purchased": row.get("distinct_products_purchased"),
        },
    )

"""
Structured catalogue of customer recommendations for Shopify fashion brands.

Recommendations are sourced from customer_insights._assign_action and
insights_generator suggested actions. Phone calls and B2B workflows are
excluded — all outreach uses allowed digital channels.
"""
from __future__ import annotations

from typing import List, Optional

from services.recommendation_models import (
    EffortLevel,
    EstimatedImpact,
    ImpactType,
    LifecycleStage,
    Recommendation,
    RecommendationCategory,
    RecommendationChannel,
    RecommendationPriority,
    RecommendationTiming,
    TriggerCondition,
)


def _rec(
    *,
    id: str,
    title: str,
    description: str,
    category: RecommendationCategory,
    priority: RecommendationPriority,
    timing: RecommendationTiming,
    channel: RecommendationChannel,
    lifecycle_stages: List[LifecycleStage],
    trigger_conditions: List[TriggerCondition],
    impact_type: ImpactType,
    impact_value: float,
    impact_description: str,
    effort: EffortLevel,
) -> Recommendation:
    return Recommendation(
        id=id,
        title=title,
        description=description,
        category=category,
        priority=priority,
        timing=timing,
        channel=channel,
        lifecycle_stages=lifecycle_stages,
        trigger_conditions=trigger_conditions,
        estimated_impact=EstimatedImpact(
            impact_type=impact_type,
            value_gbp=impact_value,
            description=impact_description,
        ),
        estimated_effort=effort,
    )


# ── Catalogue ─────────────────────────────────────────────────────────────────
# Derived from backend/services/customer_insights.py and
# backend/services/insights_generator.py segment benchmarks & suggested actions.

RECOMMENDATIONS: List[Recommendation] = [
    # ── Protect Revenue ───────────────────────────────────────────────────────
    _rec(
        id="rec-lapsed-hv-reengagement",
        title="Send personal re-engagement email",
        description=(
            "High-value lapsed customer with no purchase in 180+ days. "
            "Send a personal email referencing their last purchase — no discount, just a check-in."
        ),
        category=RecommendationCategory.PROTECT_REVENUE,
        priority=RecommendationPriority.HIGH,
        timing=RecommendationTiming.IMMEDIATELY,
        channel=RecommendationChannel.EMAIL,
        lifecycle_stages=[LifecycleStage.LAPSED, LifecycleStage.VIP],
        trigger_conditions=[
            TriggerCondition("is_lapsed", "eq", True, "No purchase in 180+ days"),
            TriggerCondition("is_high_value", "eq", True, "Revenue in top 20% of base"),
        ],
        impact_type=ImpactType.REVENUE_AT_RISK,
        impact_value=150.0,
        impact_description="Estimated revenue at risk from losing a high-value lapsed customer",
        effort=EffortLevel.MEDIUM,
    ),
    _rec(
        id="rec-at-risk-win-back",
        title="Send win-back email with genuine incentive",
        description=(
            "Valuable repeat buyer overdue by more than 2× their usual purchase gap. "
            "Send a win-back email referencing their last product with a genuine incentive — "
            "not a blanket discount blast."
        ),
        category=RecommendationCategory.PROTECT_REVENUE,
        priority=RecommendationPriority.HIGH,
        timing=RecommendationTiming.THIS_WEEK,
        channel=RecommendationChannel.EMAIL,
        lifecycle_stages=[LifecycleStage.GOING_QUIET, LifecycleStage.VIP],
        trigger_conditions=[
            TriggerCondition("is_at_risk", "eq", True, "Past 2× usual buying gap"),
            TriggerCondition("is_high_value", "eq", True, "Above-average customer value"),
            TriggerCondition("is_lapsed", "eq", False, "Not yet fully lapsed"),
        ],
        impact_type=ImpactType.REVENUE_AT_RISK,
        impact_value=120.0,
        impact_description="Revenue recoverable before customer fully lapses",
        effort=EffortLevel.LOW,
    ),
    _rec(
        id="rec-going-quiet-reengagement",
        title="Send personal re-engagement email",
        description=(
            "Repeat buyer who is overdue by their own standards but not yet at critical risk. "
            "Reference their last product in a personal email — not a batch discount blast."
        ),
        category=RecommendationCategory.PROTECT_REVENUE,
        priority=RecommendationPriority.MEDIUM,
        timing=RecommendationTiming.THIS_WEEK,
        channel=RecommendationChannel.EMAIL,
        lifecycle_stages=[LifecycleStage.GOING_QUIET],
        trigger_conditions=[
            TriggerCondition("is_at_risk", "eq", True, "Overdue vs personal cadence"),
            TriggerCondition("is_repeat_customer", "eq", True, "Has purchased before"),
            TriggerCondition("is_high_value", "eq", False, "Mid-tier customer"),
        ],
        impact_type=ImpactType.REVENUE_AT_RISK,
        impact_value=80.0,
        impact_description="Revenue at risk from a cooling repeat buyer",
        effort=EffortLevel.LOW,
    ),
    _rec(
        id="rec-lapsed-win-back-sequence",
        title="Send targeted win-back sequence",
        description=(
            "Customer with no purchase in 180+ days. One targeted win-back attempt via email, "
            "then move to a low-frequency list. Do not spam."
        ),
        category=RecommendationCategory.PROTECT_REVENUE,
        priority=RecommendationPriority.MEDIUM,
        timing=RecommendationTiming.THIS_MONTH,
        channel=RecommendationChannel.EMAIL,
        lifecycle_stages=[LifecycleStage.LAPSED],
        trigger_conditions=[
            TriggerCondition("is_lapsed", "eq", True, "No purchase in 180+ days"),
            TriggerCondition("is_high_value", "eq", False, "Mid or lower value"),
        ],
        impact_type=ImpactType.REVENUE_AT_RISK,
        impact_value=60.0,
        impact_description="Win-back cost is 5× cheaper than acquiring a new customer",
        effort=EffortLevel.MEDIUM,
    ),
    _rec(
        id="rec-sms-at-risk-nudge",
        title="Send SMS win-back nudge",
        description=(
            "High-value customer going quiet. A short SMS referencing their favourite product "
            "can cut through inbox noise for time-sensitive win-back."
        ),
        category=RecommendationCategory.PROTECT_REVENUE,
        priority=RecommendationPriority.HIGH,
        timing=RecommendationTiming.THIS_WEEK,
        channel=RecommendationChannel.SMS,
        lifecycle_stages=[LifecycleStage.GOING_QUIET, LifecycleStage.VIP],
        trigger_conditions=[
            TriggerCondition("is_at_risk", "eq", True, "Overdue vs personal cadence"),
            TriggerCondition("is_high_value", "eq", True, "High-value customer"),
        ],
        impact_type=ImpactType.REVENUE_AT_RISK,
        impact_value=100.0,
        impact_description="High-urgency retention touchpoint for valuable buyers",
        effort=EffortLevel.LOW,
    ),
    # ── Grow Revenue ──────────────────────────────────────────────────────────
    _rec(
        id="rec-onboarding-sequence",
        title="Send onboarding email sequence",
        description=(
            "First-time buyer in the last 30 days. Send a 3–4 email onboarding sequence "
            "that makes them feel noticed — not automated welcome spam."
        ),
        category=RecommendationCategory.GROW_REVENUE,
        priority=RecommendationPriority.MEDIUM,
        timing=RecommendationTiming.THIS_WEEK,
        channel=RecommendationChannel.EMAIL,
        lifecycle_stages=[LifecycleStage.NEW],
        trigger_conditions=[
            TriggerCondition("is_new_customer", "eq", True, "First purchase within 30 days"),
        ],
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=45.0,
        impact_description="30-day post-purchase window is highest-leverage retention moment",
        effort=EffortLevel.MEDIUM,
    ),
    _rec(
        id="rec-second-purchase-nudge",
        title="Send second-purchase nudge",
        description=(
            "One-time buyer in the 30–60 day conversion window. Reference the product they "
            "bought and include social proof or a bestseller recommendation."
        ),
        category=RecommendationCategory.GROW_REVENUE,
        priority=RecommendationPriority.MEDIUM,
        timing=RecommendationTiming.THIS_WEEK,
        channel=RecommendationChannel.EMAIL,
        lifecycle_stages=[LifecycleStage.ONE_TIME_BUYER],
        trigger_conditions=[
            TriggerCondition("is_one_time_buyer", "eq", True, "Single purchase only"),
            TriggerCondition("days_since_last_order", "gte", 30, "Past initial honeymoon period"),
            TriggerCondition("days_since_last_order", "lte", 60, "Still inside conversion window"),
        ],
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=55.0,
        impact_description="Best window to convert first-time buyers to repeat purchasers",
        effort=EffortLevel.LOW,
    ),
    _rec(
        id="rec-product-recommendation",
        title="Send personalised product recommendation",
        description=(
            "Repeat customer with identifiable purchase preferences. Recommend complementary "
            "or next-season items based on their most-bought product."
        ),
        category=RecommendationCategory.GROW_REVENUE,
        priority=RecommendationPriority.MEDIUM,
        timing=RecommendationTiming.THIS_MONTH,
        channel=RecommendationChannel.PRODUCT_RECOMMENDATION,
        lifecycle_stages=[LifecycleStage.REGULAR, LifecycleStage.VIP],
        trigger_conditions=[
            TriggerCondition("is_repeat_customer", "eq", True, "Has purchase history"),
            TriggerCondition("most_bought_product", "neq", None, "Known product preference"),
        ],
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=40.0,
        impact_description="Incremental revenue from relevant product suggestions",
        effort=EffortLevel.LOW,
    ),
    _rec(
        id="rec-cross-sell-complementary",
        title="Cross-sell complementary items",
        description=(
            "Customer with a dominant product preference. Cross-sell items that pair with "
            "their most-bought product and ensure the anchor SKU stays in stock."
        ),
        category=RecommendationCategory.GROW_REVENUE,
        priority=RecommendationPriority.MEDIUM,
        timing=RecommendationTiming.THIS_MONTH,
        channel=RecommendationChannel.EMAIL,
        lifecycle_stages=[LifecycleStage.REGULAR, LifecycleStage.VIP, LifecycleStage.ONE_TIME_BUYER],
        trigger_conditions=[
            TriggerCondition("most_bought_product", "neq", None, "Identifiable product affinity"),
            TriggerCondition("distinct_products_purchased", "eq", 1, "Single-product buyer"),
        ],
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=35.0,
        impact_description="Expand basket size through complementary product pairing",
        effort=EffortLevel.LOW,
    ),
    _rec(
        id="rec-free-shipping-second-purchase",
        title="Offer free shipping on second purchase",
        description=(
            "One-time buyer approaching the conversion window. Offer free shipping as a "
            "low-margin nudge to drive the critical second order."
        ),
        category=RecommendationCategory.GROW_REVENUE,
        priority=RecommendationPriority.MEDIUM,
        timing=RecommendationTiming.THIS_WEEK,
        channel=RecommendationChannel.FREE_SHIPPING,
        lifecycle_stages=[LifecycleStage.ONE_TIME_BUYER],
        trigger_conditions=[
            TriggerCondition("is_one_time_buyer", "eq", True, "Has not yet repeated"),
            TriggerCondition("days_since_last_order", "gte", 21, "Enough time since first order"),
            TriggerCondition("days_since_last_order", "lte", 45, "Inside nudge window"),
        ],
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=30.0,
        impact_description="Second-order conversion with controlled margin impact",
        effort=EffortLevel.LOW,
    ),
    _rec(
        id="rec-meta-ads-retarget",
        title="Retarget with Meta Ads",
        description=(
            "Customer showing early churn signals. Add to a Meta Ads retargeting audience "
            "with creative featuring their last purchased category."
        ),
        category=RecommendationCategory.GROW_REVENUE,
        priority=RecommendationPriority.MEDIUM,
        timing=RecommendationTiming.THIS_MONTH,
        channel=RecommendationChannel.META_ADS,
        lifecycle_stages=[LifecycleStage.GOING_QUIET, LifecycleStage.ONE_TIME_BUYER],
        trigger_conditions=[
            TriggerCondition("is_at_risk", "eq", True, "Showing churn signals"),
        ],
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=50.0,
        impact_description="Paid retargeting to recover slipping customers",
        effort=EffortLevel.MEDIUM,
    ),
    _rec(
        id="rec-tiktok-ads-lookalike",
        title="Acquire lookalikes via TikTok Ads",
        description=(
            "High-AOV new customer with strong first purchase. Use as seed audience for "
            "TikTok lookalike campaigns to attract similar fashion buyers."
        ),
        category=RecommendationCategory.GROW_REVENUE,
        priority=RecommendationPriority.LOW,
        timing=RecommendationTiming.NEXT_CAMPAIGN,
        channel=RecommendationChannel.TIKTOK_ADS,
        lifecycle_stages=[LifecycleStage.NEW],
        trigger_conditions=[
            TriggerCondition("is_new_customer", "eq", True, "Recent first purchase"),
            TriggerCondition("aov", "gt", 0, "Has measurable order value"),
        ],
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=25.0,
        impact_description="Scale acquisition using high-quality new customer signals",
        effort=EffortLevel.HIGH,
    ),
    _rec(
        id="rec-restock-notification",
        title="Send restock notification",
        description=(
            "Customer whose most-bought product may be out of stock or seasonal. "
            "Notify them when their preferred item is back — high-intent purchase trigger."
        ),
        category=RecommendationCategory.GROW_REVENUE,
        priority=RecommendationPriority.MEDIUM,
        timing=RecommendationTiming.THIS_WEEK,
        channel=RecommendationChannel.RESTOCK_NOTIFICATION,
        lifecycle_stages=[LifecycleStage.REGULAR, LifecycleStage.VIP],
        trigger_conditions=[
            TriggerCondition("most_bought_product", "neq", None, "Known product preference"),
            TriggerCondition("is_repeat_customer", "eq", True, "Proven buyer of this SKU"),
        ],
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=45.0,
        impact_description="Capture demand when anchor product returns to stock",
        effort=EffortLevel.LOW,
    ),
    # ── Improve Margin ──────────────────────────────────────────────────────────
    _rec(
        id="rec-test-full-price",
        title="Test at full price — remove from promotion",
        description=(
            "Discount-dependent customer (70%+ of orders used a discount). Remove from the "
            "next promotion and monitor — some will buy anyway, revealing true LTV."
        ),
        category=RecommendationCategory.IMPROVE_MARGIN,
        priority=RecommendationPriority.LOW,
        timing=RecommendationTiming.NEXT_CAMPAIGN,
        channel=RecommendationChannel.EMAIL,
        lifecycle_stages=[LifecycleStage.DISCOUNT_SHOPPER],
        trigger_conditions=[
            TriggerCondition("is_discount_dependent", "eq", True, "70%+ orders discounted"),
        ],
        impact_type=ImpactType.MARGIN_IMPROVEMENT,
        impact_value=20.0,
        impact_description="Margin recovered by reducing unnecessary discounting",
        effort=EffortLevel.LOW,
    ),
    _rec(
        id="rec-exclude-from-discount-campaigns",
        title="Tag and exclude from discount campaigns",
        description=(
            "Full-price loyal repeat buyer. Tag in Shopify and exclude from ALL discount "
            "campaigns to protect margin — they buy without needing a promotion."
        ),
        category=RecommendationCategory.IMPROVE_MARGIN,
        priority=RecommendationPriority.MEDIUM,
        timing=RecommendationTiming.IMMEDIATELY,
        channel=RecommendationChannel.SHOPIFY_TAGS,
        lifecycle_stages=[LifecycleStage.VIP, LifecycleStage.REGULAR],
        trigger_conditions=[
            TriggerCondition("is_full_price_loyal", "eq", True, "Never uses discounts"),
            TriggerCondition("is_repeat_customer", "eq", True, "Proven repeat buyer"),
        ],
        impact_type=ImpactType.MARGIN_IMPROVEMENT,
        impact_value=35.0,
        impact_description="Prevents training full-price buyers to wait for sales",
        effort=EffortLevel.LOW,
    ),
    _rec(
        id="rec-reduce-discount-frequency",
        title="Reduce discount frequency for dependent buyers",
        description=(
            "Customer anchored to sale prices. Gradually reduce discount exposure via "
            "targeted email — test whether they purchase at full price between campaigns."
        ),
        category=RecommendationCategory.IMPROVE_MARGIN,
        priority=RecommendationPriority.LOW,
        timing=RecommendationTiming.NEXT_CAMPAIGN,
        channel=RecommendationChannel.EMAIL,
        lifecycle_stages=[LifecycleStage.DISCOUNT_SHOPPER],
        trigger_conditions=[
            TriggerCondition("is_discount_dependent", "eq", True, "Discount on 70%+ orders"),
            TriggerCondition("discount_usage_rate", "gt", 0.85, "Heavily discount-dependent"),
        ],
        impact_type=ImpactType.MARGIN_IMPROVEMENT,
        impact_value=15.0,
        impact_description="Margin improvement from reduced promotional dependency",
        effort=EffortLevel.MEDIUM,
    ),
    # ── Strengthen Loyalty ──────────────────────────────────────────────────────
    _rec(
        id="rec-vip-audience",
        title="Add to VIP audience — no discount needed",
        description=(
            "Repeat full-price buyer. Add to a VIP email audience for exclusivity — "
            "early access, behind-the-scenes content. Never offer discounts."
        ),
        category=RecommendationCategory.STRENGTHEN_LOYALTY,
        priority=RecommendationPriority.MEDIUM,
        timing=RecommendationTiming.THIS_MONTH,
        channel=RecommendationChannel.EMAIL,
        lifecycle_stages=[LifecycleStage.VIP],
        trigger_conditions=[
            TriggerCondition("is_full_price_loyal", "eq", True, "Buys at full price"),
            TriggerCondition("is_repeat_customer", "eq", True, "Multiple orders"),
        ],
        impact_type=ImpactType.LOYALTY_STRENGTHENING,
        impact_value=50.0,
        impact_description="Protects highest-margin loyal customers",
        effort=EffortLevel.LOW,
    ),
    _rec(
        id="rec-vip-early-access",
        title="Grant early access to new collection",
        description=(
            "Champion full-price loyalist. Reward with early-access invitations to new "
            "drops — exclusivity over price cuts preserves margin and deepens loyalty."
        ),
        category=RecommendationCategory.STRENGTHEN_LOYALTY,
        priority=RecommendationPriority.MEDIUM,
        timing=RecommendationTiming.THIS_MONTH,
        channel=RecommendationChannel.EARLY_ACCESS,
        lifecycle_stages=[LifecycleStage.VIP],
        trigger_conditions=[
            TriggerCondition("is_full_price_loyal", "eq", True, "Full-price repeat buyer"),
            TriggerCondition("is_high_value", "eq", True, "Top-tier customer value"),
        ],
        impact_type=ImpactType.LOYALTY_STRENGTHENING,
        impact_value=60.0,
        impact_description="Deepens emotional loyalty with exclusivity",
        effort=EffortLevel.LOW,
    ),
    _rec(
        id="rec-loyalty-programme-reward",
        title="Reward via loyalty programme",
        description=(
            "High-value repeat customer. Enrol or upgrade in your loyalty programme with "
            "points, tier benefits, or member-only perks — not blanket discounts."
        ),
        category=RecommendationCategory.STRENGTHEN_LOYALTY,
        priority=RecommendationPriority.MEDIUM,
        timing=RecommendationTiming.THIS_MONTH,
        channel=RecommendationChannel.LOYALTY_PROGRAMME,
        lifecycle_stages=[LifecycleStage.VIP, LifecycleStage.REGULAR],
        trigger_conditions=[
            TriggerCondition("is_repeat_customer", "eq", True, "Repeat purchaser"),
            TriggerCondition("order_count", "gte", 3, "Established buyer relationship"),
        ],
        impact_type=ImpactType.LOYALTY_STRENGTHENING,
        impact_value=40.0,
        impact_description="Structured loyalty increases repeat purchase frequency",
        effort=EffortLevel.MEDIUM,
    ),
    _rec(
        id="rec-free-gift-champion",
        title="Send free gift to champion customer",
        description=(
            "Top-tier loyal buyer. Surprise with a free gift — sample, accessory, or "
            "limited-edition item. High perceived value, low margin cost."
        ),
        category=RecommendationCategory.STRENGTHEN_LOYALTY,
        priority=RecommendationPriority.MEDIUM,
        timing=RecommendationTiming.THIS_MONTH,
        channel=RecommendationChannel.FREE_GIFT,
        lifecycle_stages=[LifecycleStage.VIP],
        trigger_conditions=[
            TriggerCondition("is_high_value", "eq", True, "Top 20% by revenue"),
            TriggerCondition("is_full_price_loyal", "eq", True, "Buys without discounts"),
            TriggerCondition("order_count", "gte", 4, "Champion-level purchase frequency"),
        ],
        impact_type=ImpactType.LOYALTY_STRENGTHENING,
        impact_value=55.0,
        impact_description="Surprise gifting drives advocacy and repeat purchases",
        effort=EffortLevel.MEDIUM,
    ),
    _rec(
        id="rec-instagram-engagement",
        title="Engage on Instagram",
        description=(
            "New or loyal customer with strong brand affinity. Invite to share their purchase "
            "on Instagram or feature them in UGC — builds community for fashion brands."
        ),
        category=RecommendationCategory.STRENGTHEN_LOYALTY,
        priority=RecommendationPriority.LOW,
        timing=RecommendationTiming.ONGOING,
        channel=RecommendationChannel.INSTAGRAM,
        lifecycle_stages=[LifecycleStage.NEW, LifecycleStage.VIP],
        trigger_conditions=[
            TriggerCondition("is_new_customer", "eq", True, "Recent enthusiastic buyer"),
        ],
        impact_type=ImpactType.LOYALTY_STRENGTHENING,
        impact_value=15.0,
        impact_description="Social engagement builds community and word-of-mouth",
        effort=EffortLevel.LOW,
    ),
    _rec(
        id="rec-monitor-ongoing",
        title="Monitor — maintain regular communications",
        description=(
            "No strong behavioural signal requiring immediate action. Keep in regular "
            "email communications and watch for changing purchase patterns."
        ),
        category=RecommendationCategory.STRENGTHEN_LOYALTY,
        priority=RecommendationPriority.LOW,
        timing=RecommendationTiming.ONGOING,
        channel=RecommendationChannel.EMAIL,
        lifecycle_stages=[
            LifecycleStage.REGULAR,
            LifecycleStage.NEW,
            LifecycleStage.ONE_TIME_BUYER,
            LifecycleStage.GOING_QUIET,
            LifecycleStage.LAPSED,
            LifecycleStage.DISCOUNT_SHOPPER,
            LifecycleStage.VIP,
        ],
        trigger_conditions=[
            TriggerCondition("is_lapsed", "eq", False, "Not lapsed"),
            TriggerCondition("is_at_risk", "eq", False, "Not at risk"),
            TriggerCondition("is_new_customer", "eq", False, "Not in onboarding window"),
            TriggerCondition("is_one_time_buyer", "eq", False, "Not a one-time buyer"),
            TriggerCondition("is_discount_dependent", "eq", False, "Not discount-dependent"),
            TriggerCondition("is_full_price_loyal", "eq", False, "Not a full-price loyalist"),
        ],
        impact_type=ImpactType.LOYALTY_STRENGTHENING,
        impact_value=5.0,
        impact_description="Baseline relationship maintenance",
        effort=EffortLevel.LOW,
    ),
]


class RecommendationBank:
    """Catalogue of available recommendation templates."""

    def __init__(self, recommendations: Optional[List[Recommendation]] = None) -> None:
        self._recommendations: List[Recommendation] = list(
            recommendations if recommendations is not None else RECOMMENDATIONS
        )

    def get_all(self) -> List[Recommendation]:
        """Return all recommendations in the bank."""
        return list(self._recommendations)

    def get_by_id(self, recommendation_id: str) -> Optional[Recommendation]:
        """Return a single recommendation by identifier."""
        for recommendation in self._recommendations:
            if recommendation.id == recommendation_id:
                return recommendation
        return None

    def get_by_category(self, category: RecommendationCategory) -> List[Recommendation]:
        """Return recommendations filtered by commercial category."""
        return [r for r in self._recommendations if r.category == category]

    def get_by_lifecycle_stage(self, stage: LifecycleStage) -> List[Recommendation]:
        """Return recommendations applicable to a lifecycle stage."""
        return [r for r in self._recommendations if stage in r.lifecycle_stages]

    def count(self) -> int:
        """Return the number of recommendations in the bank."""
        return len(self._recommendations)


def load_recommendation_bank() -> RecommendationBank:
    """Load and return the recommendation bank."""
    return RecommendationBank()

"""
Structured catalogue of portfolio-level insights for Shopify fashion brands.

Insights are sourced from insights_generator.py portfolio rules and
segment benchmarks. Each entry defines when the insight fires and its
estimated commercial impact.
"""
from __future__ import annotations

from typing import List, Optional

from services.recommendation_models import (
    EstimatedImpact,
    ImpactType,
    Insight,
    InsightCategory,
    TriggerCondition,
)


def _ins(
    *,
    id: str,
    title: str,
    explanation: str,
    category: InsightCategory,
    trigger: TriggerCondition,
    impact_type: ImpactType,
    impact_value: float,
    impact_description: str = "",
) -> Insight:
    return Insight(
        id=id,
        title=title,
        explanation=explanation,
        category=category,
        trigger=trigger,
        estimated_impact=EstimatedImpact(
            impact_type=impact_type,
            value_gbp=impact_value,
            description=impact_description,
        ),
    )


# ── Catalogue ─────────────────────────────────────────────────────────────────
# Derived from backend/services/insights_generator.py portfolio insight rules
# and backend/services/customer_insights.py segment benchmarks.

INSIGHTS: List[Insight] = [
    # ── Retention Risk ────────────────────────────────────────────────────────
    _ins(
        id="retention-lapsed-high-value",
        title="High-value customers have gone cold",
        explanation=(
            "High-value customers haven't purchased in 180+ days. These aren't cold leads — "
            "they're people who already chose your brand. A personal email (not a broadcast "
            "blast) is the highest-ROI move here."
        ),
        category=InsightCategory.RETENTION_RISK,
        trigger=TriggerCondition(
            "lapsed_high_value_count", "gte", 1,
            "At least one high-value lapsed customer in the base",
        ),
        impact_type=ImpactType.REVENUE_AT_RISK,
        impact_value=0.0,
        impact_description="Sum of revenue from lapsed high-value customers",
    ),
    _ins(
        id="retention-at-risk-high-value",
        title="Win-back window open for valuable buyers",
        explanation=(
            "Customers who spend above average have gone past 2× their usual buying gap. "
            "They're not gone yet, but they're cooling. A targeted email this week — before "
            "they tip into lapsed — is your best recovery chance."
        ),
        category=InsightCategory.RETENTION_RISK,
        trigger=TriggerCondition(
            "at_risk_high_value_count", "gte", 1,
            "At least one high-value at-risk customer",
        ),
        impact_type=ImpactType.REVENUE_AT_RISK,
        impact_value=0.0,
        impact_description="Combined revenue from at-risk high-value customers",
    ),
    _ins(
        id="retention-overall-lapse-rate",
        title="Lapse rate above healthy levels",
        explanation=(
            "More than 15% of the customer base hasn't bought in 180+ days. A healthy brand "
            "should keep this below 15%. This is a systemic retention problem, not just "
            "individual customer churn."
        ),
        category=InsightCategory.RETENTION_RISK,
        trigger=TriggerCondition(
            "lapsed_pct", "gt", 15.0,
            "Lapsed customer percentage exceeds 15% benchmark",
        ),
        impact_type=ImpactType.REVENUE_AT_RISK,
        impact_value=0.0,
        impact_description="Total revenue from lapsed customers",
    ),
    _ins(
        id="retention-going-quiet-segment",
        title="Going Quiet segment is growing",
        explanation=(
            "Repeat buyers who are overdue by their own standards make up more than 15% of "
            "the base. Targeted re-engagement recovers 10–20% of this group — act before "
            "they become fully lapsed."
        ),
        category=InsightCategory.RETENTION_RISK,
        trigger=TriggerCondition(
            "going_quiet_pct", "gt", 15.0,
            "Going Quiet segment exceeds 15% of customer base",
        ),
        impact_type=ImpactType.REVENUE_AT_RISK,
        impact_value=0.0,
        impact_description="Revenue at stake across Going Quiet customers",
    ),
    _ins(
        id="retention-customer-concentration",
        title="Revenue concentrated in top 10% of customers",
        explanation=(
            "The top 10% of customers account for more than 50% of total revenue. This "
            "concentration means losing a handful of VIPs could materially hurt the "
            "business."
        ),
        category=InsightCategory.RETENTION_RISK,
        trigger=TriggerCondition(
            "top_10_pct_revenue_share", "gt", 50.0,
            "Top decile drives over half of revenue",
        ),
        impact_type=ImpactType.REVENUE_AT_RISK,
        impact_value=0.0,
        impact_description="Revenue concentrated in top customers",
    ),
    # ── Revenue Opportunity ───────────────────────────────────────────────────
    _ins(
        id="revenue-second-purchase-window",
        title="One-time buyers in the conversion window",
        explanation=(
            "Customers made their first purchase 30–60 days ago and haven't returned. This "
            "window is statistically the best time to convert them — after 60 days, chances "
            "drop sharply."
        ),
        category=InsightCategory.REVENUE_OPPORTUNITY,
        trigger=TriggerCondition(
            "one_time_buyer_30_60_count", "gte", 1,
            "One-time buyers in the 30–60 day conversion window",
        ),
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=0.0,
        impact_description="Estimated revenue if window buyers convert",
    ),
    _ins(
        id="revenue-going-quiet-recovery",
        title="Recoverable revenue in Going Quiet segment",
        explanation=(
            "Repeat buyers showing early churn signals represent recoverable revenue. "
            "Personalised re-engagement before full lapse typically recovers 10–20% of "
            "this group."
        ),
        category=InsightCategory.REVENUE_OPPORTUNITY,
        trigger=TriggerCondition(
            "at_risk_count", "gte", 5,
            "Five or more at-risk repeat customers",
        ),
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=0.0,
        impact_description="Revenue recoverable through timely win-back",
    ),
    _ins(
        id="revenue-new-customer-pipeline",
        title="Strong new customer acquisition pipeline",
        explanation=(
            "New customers in the last 30 days represent fresh revenue opportunity. The "
            "post-purchase onboarding window is the highest-leverage moment to convert "
            "them into repeat buyers."
        ),
        category=InsightCategory.REVENUE_OPPORTUNITY,
        trigger=TriggerCondition(
            "new_customer_count", "gte", 3,
            "At least three new customers in the last 30 days",
        ),
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=0.0,
        impact_description="Revenue from recent new customer cohort",
    ),
    # ── Discount Inefficiency ─────────────────────────────────────────────────
    _ins(
        id="discount-dependency",
        title="Discount-dependent customers squeezing margin",
        explanation=(
            "Customers used a discount on more than 70% of their orders. Some would buy at "
            "full price — you won't know until you test removing them from the next "
            "promotion."
        ),
        category=InsightCategory.DISCOUNT_INEFFICIENCY,
        trigger=TriggerCondition(
            "discount_dependent_count", "gte", 1,
            "At least one discount-dependent customer",
        ),
        impact_type=ImpactType.MARGIN_IMPROVEMENT,
        impact_value=0.0,
        impact_description="Total discounts given to dependent customers",
    ),
    _ins(
        id="discount-shopper-overweight",
        title="Discount Shoppers segment above healthy levels",
        explanation=(
            "More than 20% of the customer base is discount-dependent. This suggests "
            "promotions are training buyers to wait for sales rather than buying at full "
            "price."
        ),
        category=InsightCategory.DISCOUNT_INEFFICIENCY,
        trigger=TriggerCondition(
            "discount_dependent_pct", "gt", 20.0,
            "Discount-dependent customers exceed 20% of base",
        ),
        impact_type=ImpactType.MARGIN_IMPROVEMENT,
        impact_value=0.0,
        impact_description="Margin leakage from promotional dependency",
    ),
    # ── Loyalty ───────────────────────────────────────────────────────────────
    _ins(
        id="loyalty-full-price-loyalists",
        title="Full-price loyalists are your highest-margin customers",
        explanation=(
            "Repeat customers have never used a discount. These people buy at full price, "
            "repeatedly. Putting them in a promotion list trains them to wait for sales — "
            "exclude them from every campaign."
        ),
        category=InsightCategory.LOYALTY,
        trigger=TriggerCondition(
            "full_price_loyalist_count", "gte", 1,
            "At least one full-price loyal repeat customer",
        ),
        impact_type=ImpactType.LOYALTY_STRENGTHENING,
        impact_value=0.0,
        impact_description="Revenue from full-price loyal customers",
    ),
    _ins(
        id="loyalty-vip-underweight",
        title="VIP segment below healthy benchmark",
        explanation=(
            "Full-price loyal high-value customers make up less than 5% of the base. "
            "Healthy brands see VIPs at 5–10%. Focus on converting Regulars into VIPs "
            "through exclusivity, not discounts."
        ),
        category=InsightCategory.LOYALTY,
        trigger=TriggerCondition(
            "vip_pct", "lt", 5.0,
            "VIP segment below 5% of customer base",
        ),
        impact_type=ImpactType.LOYALTY_STRENGTHENING,
        impact_value=0.0,
        impact_description="Untapped VIP conversion opportunity",
    ),
    _ins(
        id="loyalty-champion-concentration",
        title="Champion customers driving disproportionate value",
        explanation=(
            "High-value full-price loyalists with 4+ orders represent your brand champions. "
            "Reward with early access and exclusivity — never with blanket discounts."
        ),
        category=InsightCategory.LOYALTY,
        trigger=TriggerCondition(
            "champion_count", "gte", 3,
            "Three or more champion-level customers (4+ orders, full-price loyal)",
        ),
        impact_type=ImpactType.LOYALTY_STRENGTHENING,
        impact_value=0.0,
        impact_description="Revenue protected by champion loyalty",
    ),
    # ── Cross Sell ────────────────────────────────────────────────────────────
    _ins(
        id="cross-sell-product-concentration",
        title="Single product dominates customer preferences",
        explanation=(
            "One product is the most-bought item for more than 40% of customers. This is "
            "both a concentration risk and a cross-sell opportunity — pair complementary "
            "items with your anchor SKU."
        ),
        category=InsightCategory.CROSS_SELL,
        trigger=TriggerCondition(
            "top_product_concentration_pct", "gt", 40.0,
            "Top product is most-bought for over 40% of customers",
        ),
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=0.0,
        impact_description="Revenue from single-product affinity group",
    ),
    _ins(
        id="cross-sell-single-product-buyers",
        title="Customers buying only one product type",
        explanation=(
            "A significant portion of customers have purchased only one distinct product. "
            "Cross-selling complementary fashion items (e.g. accessories with apparel) can "
            "expand basket size without acquiring new customers."
        ),
        category=InsightCategory.CROSS_SELL,
        trigger=TriggerCondition(
            "single_product_buyer_pct", "gt", 30.0,
            "Over 30% of customers bought only one product",
        ),
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=0.0,
        impact_description="Incremental revenue from basket expansion",
    ),
    # ── Upsell ────────────────────────────────────────────────────────────────
    _ins(
        id="upsell-low-aov-repeat-buyers",
        title="Repeat buyers with below-average order value",
        explanation=(
            "Customers who buy repeatedly but at below-average AOV are prime upsell "
            "candidates. Recommend premium lines, bundles, or higher-value alternatives "
            "based on their purchase history."
        ),
        category=InsightCategory.UPSELL,
        trigger=TriggerCondition(
            "low_aov_repeat_count", "gte", 5,
            "Five or more repeat buyers below average AOV",
        ),
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=0.0,
        impact_description="AOV uplift opportunity across repeat buyers",
    ),
    _ins(
        id="upsell-regulars-to-vip",
        title="Regulars ready for VIP elevation",
        explanation=(
            "Repeat buyers with strong purchase frequency but not yet in the VIP segment "
            "can be upsold through premium collections and early-access invitations."
        ),
        category=InsightCategory.UPSELL,
        trigger=TriggerCondition(
            "regulars_ready_for_vip_count", "gte", 5,
            "Regulars with 3+ orders and above-median revenue",
        ),
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=0.0,
        impact_description="Revenue uplift from VIP conversion",
    ),
    # ── Inventory ─────────────────────────────────────────────────────────────
    _ins(
        id="inventory-seasonal-concentration",
        title="Purchases concentrated in one season",
        explanation=(
            "A single month accounts for more than 30% of recent purchases. Heavy seasonal "
            "concentration means revenue dips sharply off-peak unless you actively drive "
            "between-season purchases."
        ),
        category=InsightCategory.INVENTORY,
        trigger=TriggerCondition(
            "peak_month_pct", "gt", 30.0,
            "Top buying month exceeds 30% of last orders",
        ),
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=0.0,
        impact_description="Revenue dependent on seasonal peak",
    ),
    _ins(
        id="inventory-anchor-sku-risk",
        title="Anchor product stock risk",
        explanation=(
            "High product concentration means stockouts on the anchor SKU could drive "
            "significant churn. Treat this product as always-in-stock and plan inventory "
            "around seasonal demand peaks."
        ),
        category=InsightCategory.INVENTORY,
        trigger=TriggerCondition(
            "top_product_concentration_pct", "gt", 35.0,
            "Anchor product concentration above 35%",
        ),
        impact_type=ImpactType.REVENUE_AT_RISK,
        impact_value=0.0,
        impact_description="Revenue at risk from anchor SKU stockout",
    ),
    # ── Returns ─────────────────────────────────────────────────────────────
    _ins(
        id="returns-high-portfolio-rate",
        title="High return rate across customer base",
        explanation=(
            "Customers with refund totals exceeding 30% of their spend indicate a returns "
            "problem — sizing, quality, or expectation mismatch. Address before scaling "
            "acquisition."
        ),
        category=InsightCategory.RETURNS,
        trigger=TriggerCondition(
            "high_return_risk_count", "gte", 3,
            "Three or more customers with >30% return rate",
        ),
        impact_type=ImpactType.MARGIN_IMPROVEMENT,
        impact_value=0.0,
        impact_description="Margin erosion from excessive returns",
    ),
    _ins(
        id="returns-new-customer-quality",
        title="New customers returning at high rates",
        explanation=(
            "Recent first-time buyers with elevated return rates suggest product-page or "
            "sizing issues. Fix before increasing ad spend on acquisition."
        ),
        category=InsightCategory.RETURNS,
        trigger=TriggerCondition(
            "new_customer_high_return_count", "gte", 2,
            "New customers with high return rates",
        ),
        impact_type=ImpactType.MARGIN_IMPROVEMENT,
        impact_value=0.0,
        impact_description="Acquisition waste from high new-buyer returns",
    ),
    # ── Customer Growth ───────────────────────────────────────────────────────
    _ins(
        id="growth-low-repeat-rate",
        title="Repeat purchase rate below benchmark",
        explanation=(
            "Fewer than 30% of customers have placed 2+ orders. A healthy brand should see "
            "30–50% repeat rate. Every customer acquired but not retained costs twice — "
            "once to get them, once when they leave."
        ),
        category=InsightCategory.CUSTOMER_GROWTH,
        trigger=TriggerCondition(
            "repeat_rate_pct", "lt", 30.0,
            "Repeat rate below 30% industry benchmark",
        ),
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=0.0,
        impact_description="Revenue leak from one-time buyer dominance",
    ),
    _ins(
        id="growth-one-time-buyer-overweight",
        title="One-Time Buyers dominate the customer base",
        explanation=(
            "More than 50% of customers have bought exactly once. 60–80% of first-time "
            "buyers never return without a specific nudge — this is the biggest revenue "
            "leak for fashion brands."
        ),
        category=InsightCategory.CUSTOMER_GROWTH,
        trigger=TriggerCondition(
            "one_time_buyer_pct", "gt", 50.0,
            "One-time buyers exceed 50% of base",
        ),
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=0.0,
        impact_description="Revenue opportunity from second-purchase conversion",
    ),
    _ins(
        id="growth-new-customer-quality",
        title="New customers spending above average",
        explanation=(
            "New customers in the last 30 days have a higher average order value than the "
            "overall base. This is a quality signal — current acquisition channels are "
            "bringing in higher-value buyers."
        ),
        category=InsightCategory.CUSTOMER_GROWTH,
        trigger=TriggerCondition(
            "new_aov_premium_pct", "gt", 10.0,
            "New customer AOV exceeds overall AOV by more than 10%",
        ),
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=0.0,
        impact_description="Revenue from high-quality new customer cohort",
    ),
    _ins(
        id="growth-lapsed-recovery-pool",
        title="Large lapsed customer recovery pool",
        explanation=(
            "A significant portion of the base is lapsed but win-back costs 5× less than "
            "new acquisition. Segment by value and run targeted recovery campaigns."
        ),
        category=InsightCategory.CUSTOMER_GROWTH,
        trigger=TriggerCondition(
            "lapsed_count", "gte", 10,
            "Ten or more lapsed customers available for win-back",
        ),
        impact_type=ImpactType.REVENUE_OPPORTUNITY,
        impact_value=0.0,
        impact_description="Recoverable revenue from lapsed pool",
    ),
]


class InsightBank:
    """Catalogue of available portfolio insights."""

    def __init__(self, insights: Optional[List[Insight]] = None) -> None:
        self._insights: List[Insight] = list(
            insights if insights is not None else INSIGHTS
        )

    def get_all(self) -> List[Insight]:
        """Return all insights in the bank."""
        return list(self._insights)

    def get_by_id(self, insight_id: str) -> Optional[Insight]:
        """Return a single insight by identifier."""
        for insight in self._insights:
            if insight.id == insight_id:
                return insight
        return None

    def get_by_category(self, category: InsightCategory) -> List[Insight]:
        """Return insights filtered by category."""
        return [i for i in self._insights if i.category == category]

    def count(self) -> int:
        """Return the number of insights in the bank."""
        return len(self._insights)


def load_insight_bank() -> InsightBank:
    """Load and return the insight bank."""
    return InsightBank()

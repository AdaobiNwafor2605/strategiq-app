"""
Shared models for the Recommendation Engine.

Data structures only — no business logic.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


# ── Enums ─────────────────────────────────────────────────────────────────────


class LifecycleStage(str, Enum):
    """Customer lifecycle classification for Shopify fashion brands."""

    VIP = "vip"
    REGULAR = "regular"
    NEW = "new"
    ONE_TIME_BUYER = "one_time_buyer"
    GOING_QUIET = "going_quiet"
    LAPSED = "lapsed"
    DISCOUNT_SHOPPER = "discount_shopper"


class RecommendationCategory(str, Enum):
    """Commercial grouping used by the Weekly Growth Plan."""

    PROTECT_REVENUE = "protect_revenue"
    GROW_REVENUE = "grow_revenue"
    IMPROVE_MARGIN = "improve_margin"
    STRENGTHEN_LOYALTY = "strengthen_loyalty"


class InsightCategory(str, Enum):
    """Portfolio insight classification."""

    RETENTION_RISK = "retention_risk"
    REVENUE_OPPORTUNITY = "revenue_opportunity"
    DISCOUNT_INEFFICIENCY = "discount_inefficiency"
    LOYALTY = "loyalty"
    CROSS_SELL = "cross_sell"
    UPSELL = "upsell"
    INVENTORY = "inventory"
    RETURNS = "returns"
    CUSTOMER_GROWTH = "customer_growth"


class RecommendationPriority(str, Enum):
    """Urgency tier for a recommendation."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RecommendationChannel(str, Enum):
    """Allowed outreach channels for Shopify fashion brands."""

    EMAIL = "email"
    SMS = "sms"
    INSTAGRAM = "instagram"
    META_ADS = "meta_ads"
    TIKTOK_ADS = "tiktok_ads"
    SHOPIFY_TAGS = "shopify_tags"
    LOYALTY_PROGRAMME = "loyalty_programme"
    FREE_GIFT = "free_gift"
    FREE_SHIPPING = "free_shipping"
    PRODUCT_RECOMMENDATION = "product_recommendation"
    EARLY_ACCESS = "early_access"
    RESTOCK_NOTIFICATION = "restock_notification"


class RecommendationTiming(str, Enum):
    """When the recommended action should be taken."""

    IMMEDIATELY = "immediately"
    THIS_WEEK = "this_week"
    THIS_MONTH = "this_month"
    NEXT_CAMPAIGN = "next_campaign"
    ONGOING = "ongoing"


class EffortLevel(str, Enum):
    """Estimated operational effort to execute the recommendation."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ImpactType(str, Enum):
    """Type of commercial impact an action may have."""

    REVENUE_AT_RISK = "revenue_at_risk"
    REVENUE_OPPORTUNITY = "revenue_opportunity"
    MARGIN_IMPROVEMENT = "margin_improvement"
    LOYALTY_STRENGTHENING = "loyalty_strengthening"


# ── Supporting structures ─────────────────────────────────────────────────────


@dataclass(frozen=True)
class TriggerCondition:
    """A single condition that must be satisfied for a recommendation or insight."""

    attribute: str
    operator: str
    value: Any
    description: str = ""


@dataclass(frozen=True)
class EstimatedImpact:
    """Quantified commercial impact for a recommendation or insight."""

    impact_type: ImpactType
    value_gbp: float
    description: str = ""


@dataclass(frozen=True)
class BehaviourFlags:
    """Boolean behavioural signals derived from purchase history."""

    is_repeat_customer: bool = False
    is_one_time_buyer: bool = False
    is_lapsed: bool = False
    is_discount_dependent: bool = False
    is_full_price_loyal: bool = False
    is_high_value: bool = False
    is_new_customer: bool = False
    is_at_risk: bool = False
    is_high_return_risk: bool = False


@dataclass(frozen=True)
class DiscountBehaviour:
    """Discount usage patterns for a customer."""

    discount_usage_rate: float = 0.0
    total_discount_amount: float = 0.0


@dataclass(frozen=True)
class ReturnBehaviour:
    """Return and refund patterns for a customer."""

    refund_total: float = 0.0
    return_rate: float = 0.0


@dataclass(frozen=True)
class PurchaseCadence:
    """Purchase frequency and recency metrics."""

    days_since_last_order: int = -1
    avg_days_between_orders: float = -1.0
    purchase_frequency: float = 0.0
    order_count: int = 0


@dataclass(frozen=True)
class CustomerValue:
    """Revenue-based value metrics for a customer."""

    total_revenue: float = 0.0
    net_revenue: float = 0.0
    aov: float = 0.0


# ── Core models ───────────────────────────────────────────────────────────────


@dataclass
class Recommendation:
    """A catalogue entry describing an actionable recommendation."""

    id: str
    title: str
    description: str
    category: RecommendationCategory
    priority: RecommendationPriority
    timing: RecommendationTiming
    channel: RecommendationChannel
    lifecycle_stages: List[LifecycleStage]
    trigger_conditions: List[TriggerCondition]
    estimated_impact: EstimatedImpact
    estimated_effort: EffortLevel


@dataclass
class Insight:
    """A portfolio-level insight describing a pattern across the customer base."""

    id: str
    title: str
    explanation: str
    category: InsightCategory
    trigger: TriggerCondition
    estimated_impact: EstimatedImpact


@dataclass
class RecommendationScore:
    """Scoring breakdown for a single recommendation."""

    recommendation_id: str
    urgency: float
    business_impact: float
    confidence: float
    customer_value: float
    total_score: float


@dataclass
class RecommendationExplanation:
    """Human-readable explanation for why a recommendation was selected."""

    recommendation_id: str
    why_selected: str
    supporting_behaviour: str
    commercial_importance: str
    expected_outcome: str

    @property
    def summary(self) -> str:
        """Concatenated explanation for display."""
        return (
            f"{self.why_selected} {self.supporting_behaviour} "
            f"{self.commercial_importance} {self.expected_outcome}"
        ).strip()


@dataclass
class CustomerProfile:
    """Aggregated customer attributes used by the decision engine."""

    customer_id: str
    lifecycle_stage: LifecycleStage
    segment: str
    behaviour_flags: BehaviourFlags
    customer_value: CustomerValue
    discount_behaviour: DiscountBehaviour
    return_behaviour: ReturnBehaviour
    purchase_cadence: PurchaseCadence
    first_product_purchased: Optional[str] = None
    most_bought_product: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ScoredRecommendation:
    """A recommendation paired with its score and explanation."""

    recommendation: Recommendation
    score: RecommendationScore
    explanation: Optional[RecommendationExplanation] = None
    opportunity_score: float = 0.0


@dataclass
class RecommendationResult:
    """Output of the recommendation pipeline for a single customer."""

    customer_id: str
    recommendations: List[ScoredRecommendation] = field(default_factory=list)
    opportunity_score: float = 0.0


@dataclass
class GrowthPlanAction:
    """A grouped action within a Weekly Growth Plan section."""

    recommendation_id: str
    action: str
    customer_count: int
    estimated_commercial_value: float
    customer_ids: List[str] = field(default_factory=list)
    channel: str = ""
    timing: str = ""


@dataclass
class GrowthPlanSection:
    """One of the four commercial sections in the Weekly Growth Plan."""

    section: str
    category: RecommendationCategory
    customer_count: int
    estimated_commercial_value: float
    actions: List[GrowthPlanAction] = field(default_factory=list)


@dataclass
class WeeklyGrowthPlan:
    """Aggregated business action plan — primary output of the recommendation engine."""

    generated_at: str
    sections: List[GrowthPlanSection] = field(default_factory=list)
    total_customers: int = 0
    total_commercial_value: float = 0.0

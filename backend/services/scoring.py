"""
Scoring engine — ranks recommendations by urgency, impact, and confidence.

Each recommendation receives four component scores (0.0–1.0) plus a weighted
total. Recommendations are returned sorted highest first.
"""
from __future__ import annotations

from typing import List, Tuple

from services.recommendation_models import (
    CustomerProfile,
    ImpactType,
    Recommendation,
    RecommendationPriority,
    RecommendationScore,
    RecommendationTiming,
)

# ── Component weightings for total_score ───────────────────────────────────────
_WEIGHT_URGENCY = 0.30
_WEIGHT_BUSINESS_IMPACT = 0.30
_WEIGHT_CONFIDENCE = 0.20
_WEIGHT_CUSTOMER_VALUE = 0.20

_PRIORITY_SCORE = {
    RecommendationPriority.HIGH: 1.0,
    RecommendationPriority.MEDIUM: 0.65,
    RecommendationPriority.LOW: 0.35,
}

_TIMING_SCORE = {
    RecommendationTiming.IMMEDIATELY: 1.0,
    RecommendationTiming.THIS_WEEK: 0.90,
    RecommendationTiming.THIS_MONTH: 0.70,
    RecommendationTiming.NEXT_CAMPAIGN: 0.50,
    RecommendationTiming.ONGOING: 0.25,
}

_IMPACT_TYPE_SCORE = {
    ImpactType.REVENUE_AT_RISK: 1.0,
    ImpactType.REVENUE_OPPORTUNITY: 0.85,
    ImpactType.MARGIN_IMPROVEMENT: 0.70,
    ImpactType.LOYALTY_STRENGTHENING: 0.60,
}

# Revenue reference points for normalisation (GBP)
_HIGH_VALUE_REVENUE = 500.0
_MAX_REVENUE_REFERENCE = 1000.0


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _score_urgency(recommendation: Recommendation, customer: CustomerProfile) -> float:
    """
    Urgency reflects recommendation priority, timing, and customer time-sensitivity.

    Customer signals: lapsed > at-risk > new/OTB window > default.
    """
    priority = _PRIORITY_SCORE.get(recommendation.priority, 0.5)
    timing = _TIMING_SCORE.get(recommendation.timing, 0.5)

    flags = customer.behaviour_flags
    cadence = customer.purchase_cadence
    if flags.is_lapsed:
        customer_signal = 1.0
    elif flags.is_at_risk:
        customer_signal = 0.90
    elif flags.is_new_customer:
        customer_signal = 0.70
    elif flags.is_one_time_buyer and 30 <= cadence.days_since_last_order <= 60:
        customer_signal = 0.75
    elif flags.is_one_time_buyer:
        customer_signal = 0.55
    else:
        customer_signal = 0.35

    return _clamp(0.45 * priority + 0.30 * timing + 0.25 * customer_signal)


def _score_business_impact(
    recommendation: Recommendation, customer: CustomerProfile
) -> float:
    """
    Business impact combines catalogue impact type with customer revenue at stake.
    """
    type_score = _IMPACT_TYPE_SCORE.get(
        recommendation.estimated_impact.impact_type, 0.5
    )
    catalogue_value = _clamp(
        recommendation.estimated_impact.value_gbp / _HIGH_VALUE_REVENUE
    )
    customer_revenue = _clamp(
        customer.customer_value.total_revenue / _MAX_REVENUE_REFERENCE
    )
    return _clamp(0.40 * type_score + 0.30 * catalogue_value + 0.30 * customer_revenue)


def _score_confidence(recommendation: Recommendation, customer: CustomerProfile) -> float:
    """
    Confidence reflects data strength — more orders and clearer flags increase it.
    """
    flags = customer.behaviour_flags
    cadence = customer.purchase_cadence
    trigger_count = len(recommendation.trigger_conditions)

    base = 0.55
    if trigger_count >= 3:
        base += 0.10
    elif trigger_count == 2:
        base += 0.05

    if cadence.order_count >= 5:
        base += 0.15
    elif cadence.order_count >= 2:
        base += 0.10

    strong_signals = sum([
        flags.is_lapsed,
        flags.is_at_risk,
        flags.is_full_price_loyal,
        flags.is_discount_dependent,
        flags.is_high_value,
    ])
    base += min(strong_signals * 0.04, 0.20)

    if cadence.days_since_last_order >= 0:
        base += 0.05

    return _clamp(base)


def _score_customer_value(customer: CustomerProfile) -> float:
    """
    Customer value reflects revenue contribution and high-value classification.
    """
    revenue_score = _clamp(customer.customer_value.total_revenue / _MAX_REVENUE_REFERENCE)
    aov_score = _clamp(customer.customer_value.aov / 150.0)
    high_value_bonus = 0.25 if customer.behaviour_flags.is_high_value else 0.0
    repeat_bonus = 0.10 if customer.behaviour_flags.is_repeat_customer else 0.0
    return _clamp(0.50 * revenue_score + 0.15 * aov_score + high_value_bonus + repeat_bonus)


def compute_total_score(
    urgency: float,
    business_impact: float,
    confidence: float,
    customer_value: float,
) -> float:
    """Weighted combination of the four scoring components."""
    return _clamp(
        _WEIGHT_URGENCY * urgency
        + _WEIGHT_BUSINESS_IMPACT * business_impact
        + _WEIGHT_CONFIDENCE * confidence
        + _WEIGHT_CUSTOMER_VALUE * customer_value
    )


def score_recommendation(
    recommendation: Recommendation, customer: CustomerProfile
) -> RecommendationScore:
    """Score a single recommendation for a customer."""
    urgency = _score_urgency(recommendation, customer)
    business_impact = _score_business_impact(recommendation, customer)
    confidence = _score_confidence(recommendation, customer)
    customer_value = _score_customer_value(customer)
    total = compute_total_score(urgency, business_impact, confidence, customer_value)
    return RecommendationScore(
        recommendation_id=recommendation.id,
        urgency=round(urgency, 4),
        business_impact=round(business_impact, 4),
        confidence=round(confidence, 4),
        customer_value=round(customer_value, 4),
        total_score=round(total, 4),
    )


class ScoringEngine:
    """Assigns scores to recommendations and returns them sorted highest first."""

    def score(
        self,
        recommendations: List[Recommendation],
        customer: CustomerProfile,
    ) -> List[RecommendationScore]:
        """Score all recommendations for a customer."""
        return [score_recommendation(rec, customer) for rec in recommendations]

    def sort_by_score(
        self,
        recommendations: List[Recommendation],
        scores: List[RecommendationScore],
    ) -> List[Recommendation]:
        """Return recommendations ordered by descending total_score."""
        score_map = {s.recommendation_id: s for s in scores}
        return sorted(
            recommendations,
            key=lambda rec: (
                score_map.get(rec.id, RecommendationScore(rec.id, 0, 0, 0, 0, 0)).total_score,
                _PRIORITY_SCORE.get(rec.priority, 0),
            ),
            reverse=True,
        )

    def score_and_rank(
        self,
        recommendations: List[Recommendation],
        customer: CustomerProfile,
    ) -> Tuple[List[Recommendation], List[RecommendationScore]]:
        """Score recommendations and return them sorted highest first."""
        scores = self.score(recommendations, customer)
        ranked = self.sort_by_score(recommendations, scores)
        return ranked, scores


def create_scoring_engine() -> ScoringEngine:
    """Factory for a scoring engine instance."""
    return ScoringEngine()

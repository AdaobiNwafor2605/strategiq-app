"""
Opportunity Score — 0–100 commercial value of acting now.

Combines customer value, urgency, conversion likelihood, and expected
commercial impact into a single actionable score.
"""
from __future__ import annotations

from typing import List, Optional

from services.recommendation_models import (
    CustomerProfile,
    ImpactType,
    Recommendation,
    RecommendationCategory,
    RecommendationScore,
    ScoredRecommendation,
)

# Component weightings (sum to 1.0)
_WEIGHT_CUSTOMER_VALUE = 0.25
_WEIGHT_URGENCY = 0.30
_WEIGHT_CONVERSION_LIKELIHOOD = 0.25
_WEIGHT_COMMERCIAL_IMPACT = 0.20

_MAX_REVENUE_REFERENCE = 1000.0


def _clamp_score(value: float) -> float:
    return max(0.0, min(100.0, value))


def _customer_value_component(customer: CustomerProfile) -> float:
    """0–100 score from revenue contribution and high-value status."""
    revenue_ratio = min(customer.customer_value.total_revenue / _MAX_REVENUE_REFERENCE, 1.0)
    aov_ratio = min(customer.customer_value.aov / 150.0, 1.0)
    score = revenue_ratio * 70 + aov_ratio * 15
    if customer.behaviour_flags.is_high_value:
        score += 15
    return min(score, 100.0)


def _urgency_component(
    customer: CustomerProfile, recommendation_score: RecommendationScore
) -> float:
    """0–100 score from recommendation and customer urgency signals."""
    base = recommendation_score.urgency * 100
    flags = customer.behaviour_flags
    if flags.is_lapsed:
        base = max(base, 85.0)
    elif flags.is_at_risk:
        base = max(base, 75.0)
    elif flags.is_new_customer:
        base = max(base, 60.0)
    return min(base, 100.0)


def _conversion_likelihood(
    customer: CustomerProfile, recommendation: Recommendation
) -> float:
    """
    0–100 estimated likelihood that acting on this recommendation converts.

    Based on lifecycle stage, behavioural signals, and recommendation category.
    """
    flags = customer.behaviour_flags
    cadence = customer.purchase_cadence
    category = recommendation.category

    if category == RecommendationCategory.PROTECT_REVENUE:
        if flags.is_at_risk and not flags.is_lapsed:
            return 65.0
        if flags.is_lapsed and flags.is_high_value:
            return 35.0
        if flags.is_lapsed:
            return 20.0
        return 40.0

    if category == RecommendationCategory.GROW_REVENUE:
        if flags.is_one_time_buyer and 30 <= cadence.days_since_last_order <= 60:
            return 55.0
        if flags.is_new_customer:
            return 50.0
        if flags.is_repeat_customer:
            return 45.0
        return 30.0

    if category == RecommendationCategory.IMPROVE_MARGIN:
        if flags.is_discount_dependent:
            rate = customer.discount_behaviour.discount_usage_rate
            if rate > 0.85:
                return 25.0
            return 40.0
        if flags.is_full_price_loyal:
            return 80.0
        return 35.0

    if category == RecommendationCategory.STRENGTHEN_LOYALTY:
        if flags.is_full_price_loyal and flags.is_high_value:
            return 75.0
        if flags.is_repeat_customer:
            return 60.0
        return 30.0

    return 40.0


def _commercial_impact_component(
    customer: CustomerProfile, recommendation: Recommendation
) -> float:
    """0–100 score from expected commercial impact type and customer revenue."""
    impact = recommendation.estimated_impact
    type_base = {
        ImpactType.REVENUE_AT_RISK: 90.0,
        ImpactType.REVENUE_OPPORTUNITY: 75.0,
        ImpactType.MARGIN_IMPROVEMENT: 60.0,
        ImpactType.LOYALTY_STRENGTHENING: 55.0,
    }.get(impact.impact_type, 50.0)

    catalogue = min(impact.value_gbp / 500.0, 1.0) * 20
    customer_rev = min(customer.customer_value.total_revenue / _MAX_REVENUE_REFERENCE, 1.0) * 20
    return min(type_base * 0.6 + catalogue + customer_rev, 100.0)


def compute_opportunity_score(
    customer: CustomerProfile,
    recommendation: Recommendation,
    recommendation_score: RecommendationScore,
) -> float:
    """
    Compute a 0–100 Opportunity Score for a single recommendation.

    Higher scores mean greater commercial value in acting now.
    """
    customer_value = _customer_value_component(customer)
    urgency = _urgency_component(customer, recommendation_score)
    conversion = _conversion_likelihood(customer, recommendation)
    commercial = _commercial_impact_component(customer, recommendation)

    weighted = (
        _WEIGHT_CUSTOMER_VALUE * customer_value
        + _WEIGHT_URGENCY * urgency
        + _WEIGHT_CONVERSION_LIKELIHOOD * conversion
        + _WEIGHT_COMMERCIAL_IMPACT * commercial
    )
    return round(_clamp_score(weighted), 1)


def compute_customer_opportunity_score(
    scored_recommendations: List[ScoredRecommendation],
) -> float:
    """
    Compute the customer-level Opportunity Score (0–100).

    Uses the highest opportunity score across all matched recommendations,
    representing the best commercial action available right now.
    """
    if not scored_recommendations:
        return 0.0
    return max(sr.opportunity_score for sr in scored_recommendations)


def apply_opportunity_scores(
    customer: CustomerProfile,
    scored_recommendations: List[ScoredRecommendation],
) -> List[ScoredRecommendation]:
    """Attach opportunity scores to scored recommendations."""
    updated: List[ScoredRecommendation] = []
    for sr in scored_recommendations:
        opp = compute_opportunity_score(customer, sr.recommendation, sr.score)
        updated.append(
            ScoredRecommendation(
                recommendation=sr.recommendation,
                score=sr.score,
                explanation=sr.explanation,
                opportunity_score=opp,
            )
        )
    return updated

"""
Explanation engine — generates human-readable recommendation explanations.

Each explanation covers why the recommendation was selected, supporting
customer behaviour, commercial importance, and expected outcome.
"""
from __future__ import annotations

from typing import List, Optional

from services.recommendation_models import (
    CustomerProfile,
    ImpactType,
    Recommendation,
    RecommendationCategory,
    RecommendationExplanation,
)


def _format_gbp(amount: float) -> str:
    return f"£{amount:,.0f}"


def _format_cadence(avg_days: float) -> Optional[str]:
    if avg_days <= 0:
        return None
    return f"every {int(round(avg_days))} days"


def _discount_summary(customer: CustomerProfile) -> str:
    rate = customer.discount_behaviour.discount_usage_rate
    if rate == 0:
        return "has never used a discount"
    pct = int(round(rate * 100))
    if pct >= 70:
        return f"used a discount on {pct}% of orders"
    return f"uses discounts on {pct}% of orders"


def _build_supporting_behaviour(customer: CustomerProfile) -> str:
    """Factual summary of the customer's purchase behaviour."""
    value = customer.customer_value
    cadence = customer.purchase_cadence
    flags = customer.behaviour_flags
    parts: List[str] = []

    if cadence.order_count > 0:
        parts.append(
            f"This customer has spent {_format_gbp(value.total_revenue)} across "
            f"{cadence.order_count} order{'s' if cadence.order_count != 1 else ''}"
        )
    else:
        parts.append(f"This customer has spent {_format_gbp(value.total_revenue)}")

    parts.append(_discount_summary(customer))

    cadence_text = _format_cadence(cadence.avg_days_between_orders)
    if cadence_text and flags.is_repeat_customer:
        parts.append(f"and normally purchases {cadence_text}")

    if cadence.days_since_last_order >= 0:
        if flags.is_at_risk and cadence_text:
            parts.append(
                f"but their last order was {cadence.days_since_last_order} days ago — "
                f"significantly overdue"
            )
        elif flags.is_lapsed:
            parts.append(
                f"with no purchase in {cadence.days_since_last_order} days"
            )
        elif flags.is_new_customer:
            parts.append(
                f"with their first purchase {cadence.days_since_last_order} days ago"
            )
        elif flags.is_one_time_buyer:
            parts.append(
                f"with their only purchase {cadence.days_since_last_order} days ago"
            )

    if customer.most_bought_product:
        parts.append(f"their most-bought item is {customer.most_bought_product}")

    if flags.is_high_return_risk and value.total_revenue > 0:
        pct = int(round(customer.return_behaviour.return_rate * 100))
        parts.append(f"They have a return rate of {pct}%")

    sentence = ". ".join(p.strip().rstrip(".") for p in parts)
    if not sentence.endswith("."):
        sentence += "."
    return sentence


def _build_why_selected(
    recommendation: Recommendation, customer: CustomerProfile
) -> str:
    """Why this recommendation applies to this specific customer."""
    flags = customer.behaviour_flags
    cadence = customer.purchase_cadence
    rec_id = recommendation.id

    overrides = {
        "rec-lapsed-hv-reengagement": (
            "This high-value customer has lapsed and needs personal re-engagement "
            "before they are lost permanently."
        ),
        "rec-at-risk-win-back": (
            "This valuable repeat buyer is past 2× their usual purchase gap — "
            "the win-back window is open now."
        ),
        "rec-second-purchase-nudge": (
            "This one-time buyer is in the 30–60 day conversion window — "
            "the highest-leverage moment to drive a second purchase."
        ),
        "rec-vip-audience": (
            "This customer buys repeatedly at full price and should be treated as VIP — "
            "not placed on discount lists."
        ),
        "rec-test-full-price": (
            "This customer is discount-dependent and may buy at full price "
            "if removed from the next promotion."
        ),
        "rec-monitor-ongoing": (
            "No urgent behavioural signal was detected — maintain regular communication "
            "and monitor for changes."
        ),
    }
    if rec_id in overrides:
        return overrides[rec_id]

    if flags.is_lapsed:
        return (
            f"This customer has not purchased in {cadence.days_since_last_order} days "
            f"and matches the {recommendation.title.lower()} criteria."
        )
    if flags.is_at_risk:
        return (
            "This customer is overdue compared to their normal buying pattern, "
            f"triggering a {recommendation.category.value.replace('_', ' ')} action."
        )
    if flags.is_new_customer:
        return (
            "As a recent first-time buyer, this customer is in the critical "
            "post-purchase retention window."
        )
    if flags.is_one_time_buyer:
        return (
            "This customer has only purchased once — converting them to a repeat "
            "buyer is the priority."
        )
    if flags.is_discount_dependent:
        return (
            "This customer's heavy discount usage is squeezing margin — "
            "testing full-price behaviour is recommended."
        )
    if flags.is_full_price_loyal:
        return (
            "This loyal full-price buyer should be rewarded with exclusivity, "
            "not discounts."
        )

    return (
        f"This customer matches the conditions for '{recommendation.title}' "
        f"based on their {customer.lifecycle_stage.value.replace('_', ' ')} lifecycle stage."
    )


def _build_commercial_importance(
    recommendation: Recommendation, customer: CustomerProfile
) -> str:
    """Commercial stakes of acting or not acting."""
    value = customer.customer_value
    flags = customer.behaviour_flags
    impact = recommendation.estimated_impact

    if impact.impact_type == ImpactType.REVENUE_AT_RISK:
        if flags.is_at_risk and not flags.is_lapsed:
            return (
                f"With {_format_gbp(value.total_revenue)} in lifetime spend, "
                "retention is a higher priority than acquisition — "
                "acting now prevents a high-value customer from lapsing."
            )
        return (
            f"An estimated {_format_gbp(value.total_revenue)} in customer lifetime value "
            "is at risk if no action is taken."
        )

    if impact.impact_type == ImpactType.REVENUE_OPPORTUNITY:
        opportunity = max(value.aov, impact.value_gbp)
        return (
            f"There is an estimated {_format_gbp(opportunity)} revenue opportunity "
            "from converting this customer to their next purchase."
        )

    if impact.impact_type == ImpactType.MARGIN_IMPROVEMENT:
        discount_given = customer.discount_behaviour.total_discount_amount
        if discount_given > 0:
            return (
                f"Reducing unnecessary discounting could recover up to "
                f"{_format_gbp(discount_given)} in margin across this customer's history."
            )
        return (
            "Protecting full-price purchase behaviour preserves margin — "
            "discounting this customer would train them to wait for sales."
        )

    if impact.impact_type == ImpactType.LOYALTY_STRENGTHENING:
        return (
            f"This customer contributes {_format_gbp(value.total_revenue)} in revenue — "
            "strengthening loyalty protects long-term brand advocacy and repeat purchases."
        )

    category_messages = {
        RecommendationCategory.PROTECT_REVENUE: (
            "Protecting existing revenue from this customer is more cost-effective "
            "than acquiring a replacement."
        ),
        RecommendationCategory.GROW_REVENUE: (
            "Growing revenue from an existing customer costs far less than new acquisition."
        ),
        RecommendationCategory.IMPROVE_MARGIN: (
            "Margin improvement on repeat buyers compounds across every future order."
        ),
        RecommendationCategory.STRENGTHEN_LOYALTY: (
            "Loyal customers drive referrals and buy at full price — protecting them pays off."
        ),
    }
    return category_messages.get(
        recommendation.category,
        "Acting on this recommendation has measurable commercial value for the business.",
    )


def _build_expected_outcome(recommendation: Recommendation) -> str:
    """What the merchant should expect if they follow the recommendation."""
    outcomes = {
        "rec-lapsed-hv-reengagement": (
            "A personal check-in email can recover 10–20% of lapsed high-value customers "
            "without eroding margin with discounts."
        ),
        "rec-at-risk-win-back": (
            "A timely win-back email this week gives the best chance of recovery "
            "before the customer fully lapses."
        ),
        "rec-second-purchase-nudge": (
            "A well-timed second-purchase nudge can double the conversion rate "
            "compared to no follow-up."
        ),
        "rec-vip-audience": (
            "Excluding this customer from discount campaigns preserves margin "
            "and reinforces their VIP status."
        ),
        "rec-test-full-price": (
            "Testing at full price reveals true customer LTV — those who still buy "
            "are more valuable than assumed."
        ),
        "rec-exclude-from-discount-campaigns": (
            "Tagging and excluding from promotions prevents training a full-price "
            "buyer to wait for sales."
        ),
        "rec-monitor-ongoing": (
            "Maintaining consistent communication keeps the brand top-of-mind "
            "until a stronger signal emerges."
        ),
    }
    if recommendation.id in outcomes:
        return outcomes[recommendation.id]

    return (
        f"Following this recommendation via {recommendation.channel.value.replace('_', ' ')} "
        f"is expected to deliver {recommendation.estimated_impact.description.lower()} "
        f"if executed {recommendation.timing.value.replace('_', ' ')}."
    )


def explain_recommendation(
    recommendation: Recommendation, customer: CustomerProfile
) -> RecommendationExplanation:
    """Generate a full explanation for a single recommendation."""
    return RecommendationExplanation(
        recommendation_id=recommendation.id,
        why_selected=_build_why_selected(recommendation, customer),
        supporting_behaviour=_build_supporting_behaviour(customer),
        commercial_importance=_build_commercial_importance(recommendation, customer),
        expected_outcome=_build_expected_outcome(recommendation),
    )


class ExplanationEngine:
    """Produces explanations for why a recommendation was selected."""

    def explain(
        self,
        recommendation: Recommendation,
        customer: CustomerProfile,
    ) -> RecommendationExplanation:
        """Generate an explanation for a single recommendation."""
        return explain_recommendation(recommendation, customer)

    def explain_all(
        self,
        recommendations: List[Recommendation],
        customer: CustomerProfile,
    ) -> List[RecommendationExplanation]:
        """Generate explanations for multiple recommendations."""
        return [self.explain(rec, customer) for rec in recommendations]


def create_explanation_engine() -> ExplanationEngine:
    """Factory for an explanation engine instance."""
    return ExplanationEngine()

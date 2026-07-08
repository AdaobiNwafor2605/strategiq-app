"""
Decision engine — determines which recommendations apply to each customer.

Evaluates all customer attributes against recommendation trigger conditions.
Does not map segment → recommendation directly. Returns all matches with no ranking.
"""
from __future__ import annotations

import logging
from typing import Any, List, Optional

from services.recommendation_bank import RecommendationBank
from services.recommendation_models import (
    CustomerProfile,
    Recommendation,
    TriggerCondition,
)

logger = logging.getLogger(__name__)

_FLAG_ATTRIBUTES = frozenset({
    "is_repeat_customer",
    "is_one_time_buyer",
    "is_lapsed",
    "is_discount_dependent",
    "is_full_price_loyal",
    "is_high_value",
    "is_new_customer",
    "is_at_risk",
    "is_high_return_risk",
})


def resolve_attribute(customer: CustomerProfile, attribute: str) -> Any:
    """
    Resolve a trigger attribute name to a value on the customer profile.

    Attributes span lifecycle stage, segment, behaviour flags, customer value,
    discount behaviour, return behaviour, and purchase cadence.
    """
    if attribute in _FLAG_ATTRIBUTES:
        return getattr(customer.behaviour_flags, attribute)

    if attribute == "lifecycle_stage":
        return customer.lifecycle_stage.value
    if attribute == "segment":
        return customer.segment

    if attribute == "days_since_last_order":
        return customer.purchase_cadence.days_since_last_order
    if attribute == "avg_days_between_orders":
        return customer.purchase_cadence.avg_days_between_orders
    if attribute == "purchase_frequency":
        return customer.purchase_cadence.purchase_frequency
    if attribute == "order_count":
        return customer.purchase_cadence.order_count

    if attribute == "total_revenue":
        return customer.customer_value.total_revenue
    if attribute == "net_revenue":
        return customer.customer_value.net_revenue
    if attribute == "aov":
        return customer.customer_value.aov

    if attribute == "discount_usage_rate":
        return customer.discount_behaviour.discount_usage_rate
    if attribute == "total_discount_amount":
        return customer.discount_behaviour.total_discount_amount

    if attribute == "refund_total":
        return customer.return_behaviour.refund_total
    if attribute == "return_rate":
        return customer.return_behaviour.return_rate

    if attribute == "most_bought_product":
        return customer.most_bought_product
    if attribute == "first_product_purchased":
        return customer.first_product_purchased

    if attribute in customer.metadata:
        return customer.metadata[attribute]

    logger.debug("Unknown attribute '%s' on customer %s", attribute, customer.customer_id)
    return None


def evaluate_condition(customer: CustomerProfile, condition: TriggerCondition) -> bool:
    """Evaluate a single trigger condition against a customer profile."""
    actual = resolve_attribute(customer, condition.attribute)
    expected = condition.value
    op = condition.operator

    if op == "eq":
        return actual == expected
    if op == "neq":
        return actual != expected
    if op == "gt":
        return _compare_numeric(actual, expected, lambda a, e: a > e)
    if op == "gte":
        return _compare_numeric(actual, expected, lambda a, e: a >= e)
    if op == "lt":
        return _compare_numeric(actual, expected, lambda a, e: a < e)
    if op == "lte":
        return _compare_numeric(actual, expected, lambda a, e: a <= e)

    logger.warning("Unsupported operator '%s' on condition %s", op, condition.attribute)
    return False


def _compare_numeric(actual: Any, expected: Any, compare) -> bool:
    try:
        if actual is None:
            return False
        return compare(float(actual), float(expected))
    except (TypeError, ValueError):
        return False


def matches_recommendation(customer: CustomerProfile, recommendation: Recommendation) -> bool:
    """
    Return True when the customer matches a recommendation.

    Requires:
    1. Customer lifecycle stage is in the recommendation's applicable stages
    2. Every trigger condition evaluates to True (AND logic)
    """
    if customer.lifecycle_stage not in recommendation.lifecycle_stages:
        return False
    return all(
        evaluate_condition(customer, condition)
        for condition in recommendation.trigger_conditions
    )


class DecisionEngine:
    """Evaluates customer attributes against recommendation trigger conditions."""

    def __init__(self, bank: RecommendationBank) -> None:
        self._bank = bank

    def evaluate(self, customer: CustomerProfile) -> List[Recommendation]:
        """
        Return all recommendations matching the given customer profile.

        No ranking is applied — ordering follows the bank catalogue sequence.
        """
        return [
            rec
            for rec in self._bank.get_all()
            if matches_recommendation(customer, rec)
        ]

    def evaluate_batch(
        self, customers: List[CustomerProfile]
    ) -> dict[str, List[Recommendation]]:
        """Evaluate multiple customers, keyed by customer_id."""
        return {customer.customer_id: self.evaluate(customer) for customer in customers}


def create_decision_engine(bank: RecommendationBank) -> DecisionEngine:
    """Factory for a configured decision engine instance."""
    return DecisionEngine(bank=bank)

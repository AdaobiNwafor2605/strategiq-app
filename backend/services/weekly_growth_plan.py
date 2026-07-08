"""
Weekly Growth Plan — aggregates customer recommendations into a business action plan.

Produces the four commercial sections: Protect Revenue, Grow Revenue,
Improve Margin, and Strengthen Loyalty.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Tuple

from services.recommendation_models import (
    CustomerProfile,
    GrowthPlanAction,
    GrowthPlanSection,
    RecommendationCategory,
    RecommendationResult,
    WeeklyGrowthPlan,
)

_SECTION_LABELS = {
    RecommendationCategory.PROTECT_REVENUE: "Protect Revenue",
    RecommendationCategory.GROW_REVENUE: "Grow Revenue",
    RecommendationCategory.IMPROVE_MARGIN: "Improve Margin",
    RecommendationCategory.STRENGTHEN_LOYALTY: "Strengthen Loyalty",
}

_SECTION_ORDER = [
    RecommendationCategory.PROTECT_REVENUE,
    RecommendationCategory.GROW_REVENUE,
    RecommendationCategory.IMPROVE_MARGIN,
    RecommendationCategory.STRENGTHEN_LOYALTY,
]


def _estimate_commercial_value(
    customer: CustomerProfile, category: RecommendationCategory
) -> float:
    """Estimate the commercial value of acting on a customer within a section."""
    value = customer.customer_value
    discount = customer.discount_behaviour

    if category == RecommendationCategory.PROTECT_REVENUE:
        return value.total_revenue
    if category == RecommendationCategory.GROW_REVENUE:
        return value.aov if value.aov > 0 else value.total_revenue * 0.5
    if category == RecommendationCategory.IMPROVE_MARGIN:
        return discount.total_discount_amount if discount.total_discount_amount > 0 else value.total_revenue * 0.1
    if category == RecommendationCategory.STRENGTHEN_LOYALTY:
        return value.total_revenue * 0.15
    return value.total_revenue * 0.1


def _format_channel(channel_value: str) -> str:
    return channel_value.replace("_", " ").title()


def _format_timing(timing_value: str) -> str:
    return timing_value.replace("_", " ").title()


def generate_weekly_growth_plan(
    results: List[RecommendationResult],
    profiles: Dict[str, CustomerProfile],
) -> WeeklyGrowthPlan:
    """
    Aggregate per-customer recommendation results into a Weekly Growth Plan.

    Each customer is assigned to their top-ranked recommendation. Actions are
    grouped by section and recommendation within the plan.
    """
    # section → recommendation_id → (action_data, customer_ids, commercial_value)
    buckets: Dict[
        RecommendationCategory,
        Dict[str, Tuple[GrowthPlanAction, List[str], float]],
    ] = defaultdict(dict)

    assigned_customers = 0

    for result in results:
        if not result.recommendations:
            continue

        top = result.recommendations[0]
        rec = top.recommendation
        category = rec.category
        customer = profiles.get(result.customer_id)
        if customer is None:
            continue

        commercial_value = _estimate_commercial_value(customer, category)
        rec_id = rec.id

        if rec_id not in buckets[category]:
            buckets[category][rec_id] = (
                GrowthPlanAction(
                    recommendation_id=rec_id,
                    action=rec.title,
                    customer_count=0,
                    estimated_commercial_value=0.0,
                    customer_ids=[],
                    channel=_format_channel(rec.channel.value),
                    timing=_format_timing(rec.timing.value),
                ),
                [],
                0.0,
            )

        action, customer_ids, total_value = buckets[category][rec_id]
        customer_ids.append(result.customer_id)
        buckets[category][rec_id] = (action, customer_ids, total_value + commercial_value)
        assigned_customers += 1

    sections: List[GrowthPlanSection] = []
    plan_total_value = 0.0

    for category in _SECTION_ORDER:
        category_buckets = buckets.get(category, {})
        if not category_buckets:
            continue

        actions: List[GrowthPlanAction] = []
        section_customer_count = 0
        section_value = 0.0

        sorted_items = sorted(
            category_buckets.items(),
            key=lambda item: len(item[1][1]),
            reverse=True,
        )

        for rec_id, (action_template, customer_ids, total_value) in sorted_items:
            action = GrowthPlanAction(
                recommendation_id=rec_id,
                action=action_template.action,
                customer_count=len(customer_ids),
                estimated_commercial_value=round(total_value, 2),
                customer_ids=customer_ids,
                channel=action_template.channel,
                timing=action_template.timing,
            )
            actions.append(action)
            section_customer_count += action.customer_count
            section_value += action.estimated_commercial_value

        sections.append(
            GrowthPlanSection(
                section=_SECTION_LABELS[category],
                category=category,
                customer_count=section_customer_count,
                estimated_commercial_value=round(section_value, 2),
                actions=actions,
            )
        )
        plan_total_value += section_value

    return WeeklyGrowthPlan(
        generated_at=datetime.now(timezone.utc).isoformat(),
        sections=sections,
        total_customers=assigned_customers,
        total_commercial_value=round(plan_total_value, 2),
    )


def format_weekly_growth_plan(plan: WeeklyGrowthPlan) -> str:
    """Render the Weekly Growth Plan as human-readable text."""
    lines = ["Weekly Growth Plan", "=" * 40, ""]
    for section in plan.sections:
        lines.append(section.section)
        for action in section.actions:
            lines.append(
                f"  • {action.action} — {action.customer_count} customer"
                f"{'s' if action.customer_count != 1 else ''}"
            )
            lines.append(
                f"    Estimated commercial value {_format_gbp(action.estimated_commercial_value)}"
            )
        lines.append(
            f"  Section total: {section.customer_count} customers, "
            f"{_format_gbp(section.estimated_commercial_value)}"
        )
        lines.append("")
    lines.append(
        f"Plan total: {plan.total_customers} customers, "
        f"{_format_gbp(plan.total_commercial_value)}"
    )
    return "\n".join(lines)


def _format_gbp(amount: float) -> str:
    return f"£{amount:,.0f}"

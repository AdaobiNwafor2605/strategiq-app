"""
Serialize recommendation engine output for API / cache storage.

Converts WeeklyGrowthPlan dataclasses into JSON-safe dicts and into the
ActionGroup shape expected by the dashboard.
"""
from __future__ import annotations

from typing import Dict, List

from services.recommendation_bank import load_recommendation_bank
from services.recommendation_models import WeeklyGrowthPlan

_PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def serialize_weekly_growth_plan(plan: WeeklyGrowthPlan) -> Dict:
    """Convert a WeeklyGrowthPlan to a JSON-safe dict."""
    return {
        "generated_at": plan.generated_at,
        "total_customers": plan.total_customers,
        "total_commercial_value": plan.total_commercial_value,
        "sections": [
            {
                "section": section.section,
                "category": section.category.value,
                "customer_count": section.customer_count,
                "estimated_commercial_value": section.estimated_commercial_value,
                "actions": [
                    {
                        "recommendation_id": action.recommendation_id,
                        "action": action.action,
                        "customer_count": action.customer_count,
                        "estimated_commercial_value": action.estimated_commercial_value,
                        "customer_ids": action.customer_ids,
                        "channel": action.channel,
                        "timing": action.timing,
                    }
                    for action in section.actions
                ],
            }
            for section in plan.sections
        ],
    }


def growth_plan_to_action_groups(plan: WeeklyGrowthPlan) -> List[Dict]:
    """Flatten a Weekly Growth Plan into dashboard ActionGroup dicts."""
    bank = load_recommendation_bank()
    rec_by_id = {rec.id: rec for rec in bank.get_all()}

    groups: List[Dict] = []
    for section in plan.sections:
        for action in section.actions:
            rec = rec_by_id.get(action.recommendation_id)
            groups.append({
                "action": action.action,
                "action_priority": rec.priority.value if rec else "medium",
                "customer_count": action.customer_count,
                "total_revenue_at_stake": action.estimated_commercial_value,
                "suggested_channel": action.channel,
                "suggested_timing": action.timing,
            })

    groups.sort(
        key=lambda g: (
            _PRIORITY_ORDER.get(g["action_priority"], 2),
            -g["customer_count"],
        )
    )
    return groups

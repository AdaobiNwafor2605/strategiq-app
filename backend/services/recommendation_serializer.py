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
    return growth_plan_json_to_action_groups(serialize_weekly_growth_plan(plan))


def growth_plan_json_to_action_groups(plan_json: Dict) -> List[Dict]:
    """Rebuild ActionGroup dicts from a serialized Weekly Growth Plan."""
    if not plan_json:
        return []
    bank = load_recommendation_bank()
    rec_by_id = {rec.id: rec for rec in bank.get_all()}
    groups: List[Dict] = []
    for section in plan_json.get("sections", []):
        for action in section.get("actions", []):
            rec = rec_by_id.get(action.get("recommendation_id", ""))
            groups.append({
                "action": action.get("action", ""),
                "action_priority": rec.priority.value if rec else "medium",
                "customer_count": int(action.get("customer_count", 0)),
                "total_revenue_at_stake": float(action.get("estimated_commercial_value", 0)),
                "suggested_channel": action.get("channel", "Email"),
                "suggested_timing": action.get("timing", "This week"),
            })
    groups.sort(
        key=lambda g: (
            _PRIORITY_ORDER.get(g["action_priority"], 2),
            -g["customer_count"],
        )
    )
    return groups

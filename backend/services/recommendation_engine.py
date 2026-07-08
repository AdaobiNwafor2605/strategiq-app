"""
Recommendation Engine — orchestrates the full recommendation pipeline.

Pipeline:
  Recommendation Bank → Decision Engine → Scoring → Explanation
  → Opportunity Score → Weekly Growth Plan
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from services.customer_profile_builder import build_customer_profile
from services.decision_engine import DecisionEngine, create_decision_engine
from services.explanation_engine import ExplanationEngine, create_explanation_engine
from services.insight_bank import InsightBank, load_insight_bank
from services.opportunity_score import (
    apply_opportunity_scores,
    compute_customer_opportunity_score,
)
from services.recommendation_bank import RecommendationBank, load_recommendation_bank
from services.recommendation_models import (
    CustomerProfile,
    RecommendationResult,
    ScoredRecommendation,
    WeeklyGrowthPlan,
)
from services.scoring import ScoringEngine, create_scoring_engine
from services.weekly_growth_plan import generate_weekly_growth_plan


@dataclass
class RecommendationEngineOutput:
    """Complete output from an end-to-end recommendation engine run."""

    results: List[RecommendationResult]
    weekly_growth_plan: WeeklyGrowthPlan
    profiles: Dict[str, CustomerProfile]


class RecommendationEngine:
    """Top-level orchestrator for customer recommendations."""

    def __init__(
        self,
        recommendation_bank: RecommendationBank,
        insight_bank: InsightBank,
        decision_engine: DecisionEngine,
        scoring_engine: ScoringEngine,
        explanation_engine: ExplanationEngine,
    ) -> None:
        self._recommendation_bank = recommendation_bank
        self._insight_bank = insight_bank
        self._decision_engine = decision_engine
        self._scoring_engine = scoring_engine
        self._explanation_engine = explanation_engine

    @property
    def recommendation_bank(self) -> RecommendationBank:
        return self._recommendation_bank

    @property
    def insight_bank(self) -> InsightBank:
        return self._insight_bank

    def generate_for_customer(self, customer: CustomerProfile) -> RecommendationResult:
        """
        Run the full recommendation pipeline for a single customer.

        Steps: decide → score → rank → explain → opportunity score.
        """
        matched = self._decision_engine.evaluate(customer)
        ranked, scores = self._scoring_engine.score_and_rank(matched, customer)
        explanations = self._explanation_engine.explain_all(ranked, customer)

        score_map = {s.recommendation_id: s for s in scores}
        explanation_map = {e.recommendation_id: e for e in explanations}

        scored = [
            ScoredRecommendation(
                recommendation=rec,
                score=score_map[rec.id],
                explanation=explanation_map.get(rec.id),
            )
            for rec in ranked
        ]
        scored = apply_opportunity_scores(customer, scored)
        return RecommendationResult(
            customer_id=customer.customer_id,
            recommendations=scored,
            opportunity_score=compute_customer_opportunity_score(scored),
        )

    def generate_for_customers(
        self, customers: List[CustomerProfile]
    ) -> List[RecommendationResult]:
        """Run the recommendation pipeline for multiple customers."""
        return [self.generate_for_customer(customer) for customer in customers]

    def generate_weekly_growth_plan(
        self,
        customers: List[CustomerProfile],
        results: Optional[List[RecommendationResult]] = None,
    ) -> WeeklyGrowthPlan:
        """
        Aggregate customer recommendations into the Weekly Growth Plan.

        If results are not provided, runs the pipeline first.
        """
        profiles = {c.customer_id: c for c in customers}
        if results is None:
            results = self.generate_for_customers(customers)
        return generate_weekly_growth_plan(results, profiles)

    def run(
        self, customers: List[CustomerProfile]
    ) -> RecommendationEngineOutput:
        """
        End-to-end pipeline: recommendations + Weekly Growth Plan.

        This is the primary entry point for the recommendation engine.
        """
        profiles = {c.customer_id: c for c in customers}
        results = self.generate_for_customers(customers)
        plan = generate_weekly_growth_plan(results, profiles)
        return RecommendationEngineOutput(
            results=results,
            weekly_growth_plan=plan,
            profiles=profiles,
        )

    def run_from_rows(
        self, rows: List[Tuple[str, Dict]]
    ) -> RecommendationEngineOutput:
        """
        End-to-end pipeline from customer_insights row dicts.

        Args:
            rows: List of (customer_id, row_dict) tuples.
        """
        customers = [
            build_customer_profile(customer_id, row)
            for customer_id, row in rows
        ]
        return self.run(customers)


def create_recommendation_engine() -> RecommendationEngine:
    """Factory that wires together all recommendation engine components."""
    bank = load_recommendation_bank()
    insights = load_insight_bank()
    return RecommendationEngine(
        recommendation_bank=bank,
        insight_bank=insights,
        decision_engine=create_decision_engine(bank),
        scoring_engine=create_scoring_engine(),
        explanation_engine=create_explanation_engine(),
    )

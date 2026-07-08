# Recommendation Engine v1

## Purpose

StrategiQ's Recommendation Engine is the strategic decision layer for Shopify fashion brands.  
It transforms customer analytics into prioritized commercial actions by answering:

- Which customers need attention
- Why they need attention
- What action to take
- How urgent each action is
- How much revenue or margin is at stake

The primary output is a **Weekly Growth Plan**, not a dashboard of disconnected metrics.

## Architecture

The engine uses a modular pipeline in `backend/services/`:

- `recommendation_models.py` — shared data models and plan models
- `recommendation_bank.py` — structured customer recommendation catalogue
- `insight_bank.py` — structured portfolio insight catalogue
- `decision_engine.py` — customer attribute evaluation against trigger conditions
- `scoring.py` — recommendation scoring and ranking
- `explanation_engine.py` — human-readable commercial reasoning
- `opportunity_score.py` — 0-100 action value score
- `weekly_growth_plan.py` — aggregation into the four plan sections
- `recommendation_engine.py` — end-to-end orchestration entry points
- `customer_profile_builder.py` — mapping row-level customer data to `CustomerProfile`

Pipeline flow:

1. Recommendation Bank
2. Decision Engine
3. Scoring
4. Explanation
5. Opportunity Score
6. Weekly Growth Plan

## Recommendation Flow

### 1) Customer Profile Construction

Input customer rows are converted to `CustomerProfile` objects using:

- Lifecycle signals
- Segment metadata
- Behaviour flags
- Customer value metrics
- Discount behaviour
- Return behaviour
- Purchase cadence

### 2) Decision Matching

`DecisionEngine` evaluates each recommendation using:

- Lifecycle stage fit
- Trigger condition matching (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`)
- Multi-attribute checks across all customer dimensions

Important: the engine does **not** directly map segment to recommendation.

### 3) Scoring and Ranking

Each matched recommendation is scored using four components:

- Urgency
- Business Impact
- Confidence
- Customer Value

Weighted total score:

`total = 0.30*urgency + 0.30*business_impact + 0.20*confidence + 0.20*customer_value`

### 4) Explanation Generation

Each recommendation gets a structured explanation containing:

- Why selected
- Supporting customer behaviour
- Commercial importance
- Expected outcome

### 5) Opportunity Score

Each recommendation receives a 0-100 **Opportunity Score**:

`opportunity = 0.25*customer_value + 0.30*urgency + 0.25*conversion_likelihood + 0.20*commercial_impact`

The customer-level opportunity score is the highest recommendation opportunity score for that customer.

### 6) Weekly Growth Plan Aggregation

Customers are assigned to their top recommendation and grouped into four sections:

- Protect Revenue
- Grow Revenue
- Improve Margin
- Strengthen Loyalty

Each section includes customer counts, estimated commercial value, actions, and supporting customer IDs.

## Lifecycle Model

Supported `LifecycleStage` values:

- `vip`
- `regular`
- `new`
- `one_time_buyer`
- `going_quiet`
- `lapsed`
- `discount_shopper`

Lifecycle is derived from behaviour flags in priority order (for example: lapsed before at-risk, at-risk before new).

## Scoring Details

Scoring component intent:

- **Urgency**: How quickly action is needed (timing + priority + customer recency risk)
- **Business Impact**: Commercial impact type plus estimated value
- **Confidence**: Signal strength based on data quality and trigger depth
- **Customer Value**: Revenue and AOV weighted by customer importance

Scores are normalized to 0.0-1.0 before weighted combination.

## Opportunity Score Details

Opportunity Score translates recommendation priority into a merchant-facing "act now" value from 0 to 100.

It combines:

- Customer value potential
- Time sensitivity
- Probability of conversion if executed
- Commercial impact of successful execution

Interpretation guidance:

- 80-100: Immediate high-value action
- 60-79: Strong near-term action
- 40-59: Useful tactical action
- 0-39: Low-priority or monitor action

## Weekly Growth Plan Structure

`WeeklyGrowthPlan` includes:

- `generated_at`
- `sections[]`
- `total_customers`
- `total_commercial_value`

Each `GrowthPlanSection` includes:

- `section` label
- `category`
- `customer_count`
- `estimated_commercial_value`
- `actions[]`

Each `GrowthPlanAction` includes:

- `recommendation_id`
- `action`
- `customer_count`
- `estimated_commercial_value`
- `customer_ids`
- `channel`
- `timing`

## Extension Points

The architecture is designed for safe extension:

- Add recommendations in `recommendation_bank.py` without modifying engine flow
- Add insight templates in `insight_bank.py`
- Add new trigger operators in `decision_engine.py`
- Adjust scoring weights in `scoring.py`
- Evolve opportunity formula in `opportunity_score.py`
- Add new plan sections or aggregation rules in `weekly_growth_plan.py`
- Swap or enhance explanation templates in `explanation_engine.py`

## Usage Entry Points

Primary orchestration APIs:

- `create_recommendation_engine()`
- `RecommendationEngine.run(customers)`
- `RecommendationEngine.run_from_rows(rows)`
- `RecommendationEngine.generate_for_customer(customer)`
- `RecommendationEngine.generate_weekly_growth_plan(customers, results=None)`

These methods produce recommendation results and a weekly plan in one consistent pipeline.

## Constraints and Guardrails

Recommendation content is intentionally constrained for Shopify fashion operations:

- No phone call recommendations
- No B2B workflow assumptions
- No generic CRM-only advice detached from commerce outcomes
- Action channels restricted to predefined approved channels

## Outcome

This architecture shifts StrategiQ from reporting analytics to directing commercial decisions.  
The merchant receives a prioritized weekly plan with clear actions and explicit value at stake, enabling focused execution each week.

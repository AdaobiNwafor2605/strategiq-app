# Baseline Tests

This folder is a fixed reference point captured before any v2 changes. It lets us verify that v2 produces the same core numbers as v1 when given the same input.

## Files

| File | Purpose |
|------|---------|
| `48-record-baseline.csv` | Synthetic Shopify clothing brand CSV (48 orders, 20 customers, 8 products) |
| `run_baseline.py` | Runs the CSV through the v1 pipeline and saves all analytics outputs |
| `baseline-outputs.json` | The locked reference outputs — do not edit by hand |

## Baseline numbers (as of 2026-07-07)

| Metric | Value |
|--------|-------|
| Total revenue | 4476.79 (mixed GBP/USD — no currency conversion) |
| Active customers | 20 |
| Average order value | 93.27 |
| Churn risk | 0.0% (all orders within 60 days of run date) |
| Customer segments | 8 (Champions, Cannot Lose Them, Potential Loyalist, Need Attention, Loyal Customers, New Customers, At Risk, Hibernating) |

## What the CSV contains

- 48 orders, IDs #1001–#1048
- 20 unique customers across UK and US locations
- 8 products: Oversized Hoodie, Cargo Trousers, Ribbed Knit Set, Leather Jacket, Wide Leg Jeans, Puffer Vest, Slouchy Tee 3-Pack, Mini Skirt
- Orders spread across 60 days (2026-05-08 to 2026-07-06)
- Mixed GBP and USD pricing (GBP free shipping ≥ £75, else £3.99; USD free ≥ $90, else $4.99)
- 2 voided orders (#1013, #1046) — included by the pipeline since voided orders are not filtered
- Returning customers and new customers mixed in

## How to regenerate

```bash
cd baseline-tests
python run_baseline.py
```

Run from the project root (`FashionIQ/`). The script adds `backend/` to its Python path automatically so it can import the backend services directly.

After running, compare `baseline-outputs.json` against the locked values above. If core numbers change, something in the pipeline changed — investigate before proceeding.

## When to re-run

- After any change to a protected backend file (`core_config.py`, `services/data_cleaner.py`, `services/analytics.py`, `utils/validators.py`, or `main.py`'s `make_json_safe`/`safe_divide`)
- After v2 is complete, to confirm v2 matches v1 outputs on the same input

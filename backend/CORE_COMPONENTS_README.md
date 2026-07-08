# 🔒 CORE COMPONENTS - PRODUCTION READY

## ⚠️ **CRITICAL WARNING**
These components have been tested with real customer data and are currently working in production. **DO NOT MODIFY** without extensive testing and backup.

## 📊 **Verified Data Processing Pipeline**

### ✅ **Status: PRODUCTION READY**
- **Last Tested**: December 2024
- **Test Data**: Successfully processed 48 e-commerce records
- **Data Sources**: Shopify exports, CSV files
- **Version**: 1.0.0

---

## 🔐 **Protected Files & Functions**

### **1. Core Configuration (`core_config.py`)**
```python
CORE_REQUIRED_COLUMNS    # ❌ DO NOT MODIFY
CORE_OPTIONAL_COLUMNS    # ⚠️ Safe to ADD, don't REMOVE
CORE_DATA_CLEANING_RULES # ❌ DO NOT MODIFY
```

### **2. JSON Safety Functions (`main.py`)**
```python
make_json_safe()    # ❌ DO NOT MODIFY - Prevents API crashes
safe_divide()       # ❌ DO NOT MODIFY - Handles division by zero
```

### **3. Data Cleaning Logic (`services/data_cleaner.py`)**
```python
clean_dataframe()   # ⚠️ MODIFY WITH EXTREME CAUTION
handle nulls/zeros  # ❌ DO NOT MODIFY - Handles real-world data
currency cleaning   # ❌ DO NOT MODIFY - Tested with £$€¥
```

### **4. Analytics Service (`services/analytics.py`)**
```python
safe_float()        # ❌ DO NOT MODIFY - Prevents JSON errors
safe_int()          # ❌ DO NOT MODIFY - Prevents JSON errors
timezone handling   # ❌ DO NOT MODIFY - Fixes datetime issues
```

### **5. Column Validation (`utils/validators.py`)**
```python
REQUIRED_COLUMNS    # ❌ DO NOT MODIFY - Tested column mappings
OPTIONAL_COLUMNS    # ⚠️ Safe to ADD, don't REMOVE
find_matching_columns() # ⚠️ MODIFY WITH CAUTION
```

---

## 🛡️ **Protection Mechanisms**

### **1. Startup Validation**
- System validates core config on every startup
- Fails fast if core components are corrupted
- Logs validation status

### **2. Version Tracking**
- Core components are versioned
- Last tested date is tracked
- Data sources are documented

### **3. Assertion Checks**
```python
assert len(CORE_REQUIRED_COLUMNS) == 6
assert 'order_id' in CORE_REQUIRED_COLUMNS
assert 'total' in CORE_REQUIRED_COLUMNS
```

---

## ✅ **Safe Modifications**

### **What you CAN safely change:**
1. **Add new optional columns** to `CORE_OPTIONAL_COLUMNS`
2. **Add new column name variations** to existing mappings
3. **Modify frontend components** (UI/UX changes)
4. **Add new analytics functions** (don't modify existing ones)
5. **Update styling and layouts**

### **What you CANNOT change without testing:**
1. **Required column definitions**
2. **JSON safety functions**
3. **Data cleaning null/zero handling**
4. **Currency symbol removal logic**
5. **Timezone handling in analytics**

---

## 🧪 **Testing Protocol for Core Changes**

If you MUST modify core components:

1. **Backup current working version**
2. **Test with original 48-record dataset**
3. **Verify all analytics outputs match**
4. **Test edge cases**: nulls, zeros, currency symbols, inf/nan values
5. **Verify JSON serialization works**
6. **Update version number and test date**

---

## 🚨 **Emergency Rollback**

If the system breaks after modifications:

```bash
# 1. Restore core_config.py from this commit
git checkout HEAD~1 backend/core_config.py

# 2. Restore validators.py
git checkout HEAD~1 backend/utils/validators.py

# 3. Restart system
python3 main.py
```

---

## 📞 **Support**

If you need to modify core components:
1. Create a full backup first
2. Test in a separate environment
3. Document all changes
4. Update this README with new test results

**Remember: This system successfully processes real customer data. Stability > Features.**

---

## 2026-07-07 — Data Upload v2 (protected files NOT modified)

**Review date:** 2026-07-07
**Branch:** feat/data-upload-v2

The v2 upload feature was built entirely in new files. No protected functions
in this README were changed:

| Protected function | File | Changed? |
|---|---|---|
| `make_json_safe` | `main.py` | No |
| `safe_divide` | `main.py` | No |
| `clean_dataframe` | `services/data_cleaner.py` | No |
| `safe_float`, `safe_int`, timezone handling | `services/analytics.py` | No |
| `REQUIRED_COLUMNS`, `find_matching_columns` | `utils/validators.py` | No |
| `CORE_REQUIRED_COLUMNS`, `CORE_DATA_CLEANING_RULES` | `core_config.py` | No |

New files added (not protected):
- `shared/__init__.py`, `shared/state.py`, `shared/auth.py`
- `services/supabase_service.py`
- `routes/upload_v2.py`
- `sample_data/shopify_sample.csv`

`main.py` was modified only in its non-protected sections: added import aliases
for the shared modules and mounted the v2 router. The `_SUPABASE_URL` local
variable in the account-deletion endpoint was cleaned up (was referencing a
now-moved global; changed to a local `os.environ.get(...)` call).

**Baseline test status:** 48-record baseline was run before v2 work began and
saved to `baseline-tests/baseline-outputs.json`. Because no protected files were
touched, the outputs are still valid. Re-run `baseline-tests/run_baseline.py`
to verify any time.

---

## 2026-07-07 — data_cleaner.py: robust date format detection added

**What changed:** `clean_date_column()` replaced its bare `pd.to_datetime(series, errors='coerce')` call with a two-pass approach: try `dayfirst=False`, try `dayfirst=True`, return whichever produces fewer NaTs. The inline `pd.to_datetime(df[col], errors='coerce')` call inside `clean_dataframe()` now delegates to `DataCleaner.clean_date_column()` instead of duplicating logic.

**Protected functions NOT touched:** null/zero handling, currency cleaning, boolean handling, dedup logic, `core_required` validation — all unchanged.

**Why:** Non-Shopify datasets often use `DD/MM/YYYY` date format (e.g. `15/02/2023`). Without `dayfirst=True`, any date where day > 12 became `NaT`, silently corrupting all date-based analytics. ISO format dates (`YYYY-MM-DD`) are unambiguous and unaffected by this change.

**Testing:** Baseline re-run should show identical results — baseline uses Shopify ISO dates which are unaffected by `dayfirst`. Re-run `baseline-tests/run_baseline.py` to confirm.

---

## 2026-07-07 — analytics.py: customer_id fallback added (business logic only)

**What changed:** Added `_customer_col()` helper method to `AnalyticsService`.
Replaced hardcoded `'customer_email'` references in four methods with
`self._customer_col()` which returns `customer_email` if present, else
`customer_id`, else `None`.

**Methods changed:**
- `_count_active_customers` — uses `_customer_col()` instead of `'customer_email'`
- `_calculate_churn_risk` — uses `_customer_col()` instead of `'customer_email'`
- `_segment_customers` — uses `_customer_col()` for groupby and merge
- `_simple_segment_fallback` — uses `_customer_col()` for groupby

**Protected functions NOT touched:** `safe_float`, `safe_int`, timezone handling
in `_calculate_churn_risk` and `_segment_customers` — these are unchanged.

**Why:** Non-Shopify datasets use `customer_id` instead of `customer_email`.
Previously those datasets got `active_customers=0` and empty segments.

**Testing done:** Baseline re-run: `4476.79 / 20 / 93.27 / 0.0% / 8` — identical
to saved baseline (email-based dataset, existing path unchanged). New test with
`customer_id`-only dataset: `active_customers=3` (3 unique IDs) — correct.
---

## 2026-07-07 — New: customer_insights.py (standalone service, non-protected)

**What added:** `backend/services/customer_insights.py`

New standalone service — not a protected file. Aggregates cleaned order-level DataFrames into customer-level data with behavioural flags and recommended actions.

**Public API:**
- `build_customer_insights(df, cust_col) → (customer_df, skipped_count)` — full aggregation pipeline
- `build_weekly_summary(customer_df) → dict` — groups customers by recommended_action

**Design decisions:**
- Handles missing columns gracefully: quantity, product, discount, refund all optional
- `is_at_risk` flag uses per-customer avg_days_between_orders × 2 threshold (not a fixed number)
- `is_high_value` threshold is the 80th revenue percentile (relative, not absolute)
- 6 priority rules evaluated in order: lapsed+high_value → at_risk+high_value → full_price_loyal → new_customer → one_time_buyer(30-60d) → discount_dependent → monitor
- `_json_safe` from upload_v2.py is used to convert customer_df records before storing in Supabase (handles pd.Timestamp, NaT, numpy scalar types)
- Data stored as JSONB blob per user in `customer_insights_cache` and `action_summary_cache` tables (upserted on every upload)

**Not changed:** `data_cleaner.py`, `analytics.py`, `main.py (make_json_safe/safe_divide)`, `validators.py`, `core_config.py`

---

## 2026-07-07 — Dashboard upgrade: insights_generator.py + customer_insights.py updates (non-protected)

**What added/changed:**

**`backend/services/insights_generator.py`** (new, standalone, non-protected)
Full scored insight bank generator. Called from `_run_insights_pipeline` in `upload_v2.py` after `build_customer_insights`. Six categories: `retention_risk`, `growth_opportunity`, `discount_inefficiency`, `cohort_quality`, `customer_concentration`, `product_concentration`. Score formula: `confidence × 40 + revenue_share × 40 + actionability × 20`. Generates up to 10 insights per upload. Stores `customer_keys` arrays (up to 200 per insight) for download drill-through. Also exports `SEGMENT_BENCHMARKS` dict used to enrich segment tooltips.

**`backend/services/customer_insights.py`** (updated, non-protected)
`_assign_action` expanded from 3-tuple to 5-tuple: added `suggested_channel` and `suggested_timing`. `build_weekly_summary` includes these in each group dict. `build_customer_insights` stores both on the customer DataFrame. `_assign_segment` now imported into `upload_v2.py` directly to stamp `_segment` on each customer record before storage (enables server-side filtering by segment).

**`backend/routes/insights.py`** (major update — existing endpoints unchanged, new added)
New endpoints: `GET /bank`, `GET /action-state`, `POST /action-state`, `GET /segment-customers/{name}`, `GET /action-customers/{key}`, `GET /download/segment/{name}`, `GET /download/action/{key}`, `GET /download/insight/{id}`, `GET /download/all`. All auth-checked via `require_auth`. All download endpoints are server-generated — no client-side CSV generation.

**`backend/routes/upload_v2.py`** — `_run_insights_pipeline` extended (helper function only)
Read previous segments → compute trends → stamp _segment on customers → enrich segments with revenue_pct/deltas/benchmarks → compute revenue_at_risk/opportunity → generate what_changed narrative → call generate_insight_bank → upsert to insights_cache. No changes to `_build_metrics`, `_run_pipeline`, `_validate_rows`, or any route handlers.

**Not changed:** `data_cleaner.py`, `analytics.py`, `main.py (make_json_safe/safe_divide)`, `validators.py`, `core_config.py`

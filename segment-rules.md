# Customer Segment Rules

This file documents exactly how customers are assigned to segments. All thresholds can be changed in:

**`backend/services/customer_insights.py`**

---

## Step 1 — Behavioural Flags

Every customer gets a set of true/false flags computed from their order history. These flags are calculated once at upload time.

| Flag | What it means | How it's calculated |
|------|--------------|---------------------|
| `is_lapsed` | No purchase in a long time | `days_since_last_order >= 180` |
| `is_high_value` | Top spender | `total_revenue >= 80th percentile` of all customers |
| `is_full_price_loyal` | Repeat buyer who never used a discount | `order_count >= 2` AND `discount_usage_rate == 0` |
| `is_at_risk` | Repeat buyer overdue by their own standards | `days_since_last_order > 2 × avg_days_between_orders` |
| `is_new_customer` | Very recent first purchase | `days_since_last_order` between 0 and 30 |
| `is_one_time_buyer` | Bought exactly once | `order_count == 1` |
| `is_discount_dependent` | Most orders used a discount | `discount_usage_rate > 0.70` (70% of their orders had a discount) |
| `is_repeat_customer` | Bought more than once | `order_count >= 2` |

> **`days_since_last_order`** is calculated as today's date minus the date of their most recent order, in days.
>
> **`avg_days_between_orders`** is the average number of days between consecutive purchases (only meaningful for repeat buyers).
>
> **`discount_usage_rate`** is the proportion of their orders that included a discount code.

---

## Step 2 — Segment Assignment

Once flags are set, each customer is assigned to exactly one segment. **The order matters — first match wins.**

```
1. is_lapsed?                              → Lapsed
2. is_high_value AND is_full_price_loyal?  → VIPs
3. is_at_risk?                             → Going Quiet
4. is_new_customer?                        → New Customers
5. is_one_time_buyer?                      → One-Time Buyers
6. is_discount_dependent?                  → Discount Shoppers
7. (none of the above)                     → Regulars
```

### Why this order matters

- **Lapsed is checked first** — if a customer hasn't bought in 180+ days, that takes priority over everything else (even if they're a VIP or formerly discount-free).
- **VIPs are second** — only customers who haven't lapsed, have high revenue, and never used a discount reach this segment.
- **Going Quiet is third** — catches repeat buyers who are overdue before they become lapsed.
- **New Customers is fourth** — anyone who bought in the last 30 days.
- **One-Time Buyers is fifth** — a single purchase customer who doesn't fall into lapsed/new/going quiet.
- **Discount Shoppers is sixth** — heavy discount users who don't meet any of the above.
- **Regulars is the catch-all** — repeat buyers with no strong signal.

---

## Why All Customers Might End Up in Lapsed

If your entire customer base falls into **Lapsed**, it means `days_since_last_order >= 180` is true for all of them. This happens when:

1. **Your CSV data is old** — the orders in your file are all from more than 6 months ago. The flags are computed at upload time using the most recent order date in the data.

2. **The 180-day threshold is too low for your business** — fashion brands that sell seasonally (twice a year) will naturally see many customers with 180+ day gaps. A 365-day threshold might be more appropriate.

3. **The date column wasn't parsed correctly** — if order dates came through as text the system couldn't read, `days_since_last_order` may have defaulted incorrectly.

---

## How to Change the Thresholds

All thresholds are in `backend/services/customer_insights.py`, around line 181.

### Changing the lapsed threshold (most common change)

```python
# Current: 180 days (6 months)
customer_df["is_lapsed"] = customer_df["days_since_last_order"] >= 180

# Change to 365 days (12 months) for seasonal brands:
customer_df["is_lapsed"] = customer_df["days_since_last_order"] >= 365
```

### Changing the new customer window

```python
# Current: 0–30 days
customer_df["is_new_customer"] = (
    (customer_df["days_since_last_order"] >= 0)
    & (customer_df["days_since_last_order"] <= 30)
)

# Change to 0–60 days:
customer_df["is_new_customer"] = (
    (customer_df["days_since_last_order"] >= 0)
    & (customer_df["days_since_last_order"] <= 60)
)
```

### Changing the discount dependency threshold

```python
# Current: 70% of orders had a discount
customer_df["is_discount_dependent"] = customer_df["discount_usage_rate"] > 0.70

# Change to 50%:
customer_df["is_discount_dependent"] = customer_df["discount_usage_rate"] > 0.50
```

### Changing the high-value threshold

```python
# Current: top 20% by revenue (80th percentile)
revenue_top20 = customer_df["total_revenue"].quantile(0.80)
customer_df["is_high_value"] = customer_df["total_revenue"] >= revenue_top20

# Change to top 10% (90th percentile):
revenue_top20 = customer_df["total_revenue"].quantile(0.90)
customer_df["is_high_value"] = customer_df["total_revenue"] >= revenue_top20
```

### Changing the at-risk multiplier

```python
# Current: overdue by more than 2× their average gap
return dslo > 2 * avg  # in _flag_at_risk()

# Change to 1.5× for earlier detection:
return dslo > 1.5 * avg
```

---

## After Changing Thresholds

After any threshold change, you need to **re-upload your CSV** so the flags get recomputed with the new rules. The segments shown in the dashboard are based on flags calculated at upload time — they don't update automatically.

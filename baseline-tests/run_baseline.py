"""
Run the 48-record baseline CSV through the v1 upload pipeline and save all outputs.

Usage (from project root):
    cd baseline-tests && python run_baseline.py

Outputs:
    baseline-outputs.json — all analytics results for regression testing
"""
import sys
import os
import json
from pathlib import Path

# Add backend to path so we can import its modules directly
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

import pandas as pd
import numpy as np

from utils.validators import COLUMN_MAPPINGS, find_matching_column
from services.data_cleaner import DataCleaner
from services.analytics import AnalyticsService

CSV_PATH = Path(__file__).resolve().parent / "48-record-baseline.csv"
OUTPUT_PATH = Path(__file__).resolve().parent / "baseline-outputs.json"


def make_json_safe(obj):
    """Recursively convert numpy/pandas types and non-finite floats to JSON-safe values."""
    if isinstance(obj, dict):
        return {k: make_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [make_json_safe(v) for v in obj]
    if isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return 0.0
        return obj
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        return 0.0 if (np.isnan(v) or np.isinf(v)) else v
    if isinstance(obj, (np.ndarray,)):
        return make_json_safe(obj.tolist())
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    return obj


def run_pipeline(csv_path: Path) -> pd.DataFrame:
    """Replicate what /api/process-files does: read → map columns → clean."""
    encodings = ("utf-8-sig", "utf-8", "latin-1", "cp1252")
    df = None
    for enc in encodings:
        try:
            df = pd.read_csv(csv_path, encoding=enc)
            break
        except Exception:
            continue
    if df is None:
        raise RuntimeError(f"Could not read {csv_path}")

    print(f"Loaded CSV: {len(df)} rows, columns: {list(df.columns)}")

    # Build column_mappings exactly as process-files does
    column_mappings = {}
    for standard_col, possible_names in COLUMN_MAPPINGS.items():
        matched_col = find_matching_column(df, possible_names)
        if matched_col:
            column_mappings[matched_col] = standard_col

    print(f"Column mappings: {column_mappings}")

    cleaner = DataCleaner()
    df_clean = cleaner.clean_dataframe(df, column_mappings)
    print(f"After cleaning: {len(df_clean)} rows, columns: {list(df_clean.columns)}")
    return df_clean


def compute_top_products(df: pd.DataFrame, limit: int = 10, sort_by: str = "revenue") -> dict:
    """Replicate /api/analytics/top-products."""
    required = ['product_name', 'total', 'quantity']
    if any(c not in df.columns for c in required):
        return {"error": f"Missing columns", "data": []}

    stats = df.groupby('product_name').agg({
        'total': 'sum',
        'quantity': 'sum',
        'order_id': 'nunique',
        'unit_price': 'mean'
    }).reset_index()

    stats = stats.sort_values('quantity' if sort_by == 'volume' else 'total', ascending=False)
    top = stats.head(limit)

    data = []
    for _, row in top.iterrows():
        data.append({
            "product_name": row['product_name'],
            "total_revenue": float(row['total']),
            "total_quantity": int(row['quantity']),
            "unique_orders": int(row['order_id']),
            "avg_unit_price": float(row['unit_price']) if pd.notna(row['unit_price']) else 0.0,
            "revenue_per_unit": float(row['total'] / row['quantity']) if row['quantity'] > 0 else 0.0
        })

    return {"sort_by": sort_by, "total_products": int(len(stats)), "data": data}


def compute_revenue_trends(df: pd.DataFrame, period: str = "monthly") -> dict:
    """Replicate /api/analytics/revenue-trends."""
    if 'order_date' not in df.columns or 'total' not in df.columns:
        return {"error": "Required columns missing", "data": []}

    df = df.copy()
    df['order_date'] = pd.to_datetime(df['order_date'], errors='coerce')
    valid = df[df['order_date'].notna()].copy()

    if period == "daily":
        valid['period'] = valid['order_date'].dt.date
    elif period == "weekly":
        valid['period'] = valid['order_date'].dt.to_period('W').dt.start_time.dt.date
    else:
        valid['period'] = valid['order_date'].dt.to_period('M')

    trends = valid.groupby('period').agg({'total': 'sum', 'order_id': 'nunique'}).reset_index()
    trends['period_str'] = trends['period'].astype(str)
    trends = trends.sort_values('period')
    trends['revenue_change'] = trends['total'].pct_change() * 100

    data = []
    for _, row in trends.iterrows():
        data.append({
            "period": row['period_str'],
            "revenue": float(row['total']),
            "orders": int(row['order_id']),
            "change_percent": float(row['revenue_change']) if not pd.isna(row['revenue_change']) else 0.0
        })

    return {"period_type": period, "total_periods": len(data), "data": data}


def compute_aov_trends(df: pd.DataFrame, period: str = "monthly") -> dict:
    """Replicate /api/analytics/aov-trends."""
    if any(c not in df.columns for c in ['order_date', 'total', 'order_id']):
        return {"error": "Required columns missing", "data": []}

    df = df.copy()
    df['order_date'] = pd.to_datetime(df['order_date'], errors='coerce')
    valid = df[df['order_date'].notna()].copy()

    if period == "daily":
        valid['period'] = valid['order_date'].dt.date
    elif period == "weekly":
        valid['period'] = valid['order_date'].dt.to_period('W').dt.start_time.dt.date
    else:
        valid['period'] = valid['order_date'].dt.to_period('M')

    trends = valid.groupby('period').agg({'total': 'sum', 'order_id': 'nunique'}).reset_index()
    trends['aov'] = trends['total'] / trends['order_id']
    trends['period_str'] = trends['period'].astype(str)
    trends = trends.sort_values('period')
    trends['aov_change'] = trends['aov'].pct_change() * 100

    data = []
    for _, row in trends.iterrows():
        data.append({
            "period": row['period_str'],
            "aov": float(row['aov']),
            "total_revenue": float(row['total']),
            "total_orders": int(row['order_id']),
            "change_percent": float(row['aov_change']) if pd.notna(row['aov_change']) else 0.0
        })

    return {"period_type": period, "data": data}


def compute_customer_analysis(df: pd.DataFrame) -> dict:
    """Replicate /api/analytics/customer-analysis."""
    if any(c not in df.columns for c in ['customer_email', 'order_date']):
        return {"error": "Required columns missing", "data": []}

    df = df.copy()
    df['order_date'] = pd.to_datetime(df['order_date'], errors='coerce')
    valid = df[df['order_date'].notna()].copy()

    first_orders = valid.groupby('customer_email')['order_date'].min().reset_index()
    first_orders.columns = ['customer_email', 'first_order_date']
    analysis = valid.merge(first_orders, on='customer_email')
    analysis['order_period'] = analysis['order_date'].dt.to_period('M')
    analysis['first_order_period'] = analysis['first_order_date'].dt.to_period('M')
    analysis['customer_type'] = analysis.apply(
        lambda r: 'New' if r['order_period'] == r['first_order_period'] else 'Returning', axis=1
    )

    trends = analysis.groupby(['order_period', 'customer_type']).agg({
        'customer_email': 'nunique', 'total': 'sum'
    }).reset_index()

    result = []
    for period in sorted(trends['order_period'].unique()):
        period_data = trends[trends['order_period'] == period]
        new_r = period_data[period_data['customer_type'] == 'New']
        ret_r = period_data[period_data['customer_type'] == 'Returning']
        new_c = int(new_r['customer_email'].sum()) if len(new_r) > 0 else 0
        ret_c = int(ret_r['customer_email'].sum()) if len(ret_r) > 0 else 0
        total_c = new_c + ret_c
        result.append({
            "period": str(period),
            "new_customers": new_c,
            "returning_customers": ret_c,
            "total_customers": total_c,
            "new_customer_revenue": float(new_r['total'].sum()) if len(new_r) > 0 else 0.0,
            "returning_customer_revenue": float(ret_r['total'].sum()) if len(ret_r) > 0 else 0.0,
            "returning_percentage": (ret_c / total_c * 100) if total_c > 0 else 0.0
        })

    return {"data": result}


def compute_geographic_analysis(df: pd.DataFrame) -> dict:
    """Replicate /api/analytics/geographic-analysis."""
    location_col = None
    for col in ['customer_location', 'city', 'location', 'billing_city', 'country']:
        if col in df.columns:
            location_col = col
            break
    if location_col is None:
        return {"error": "No location data found", "data": []}

    geo = df.groupby(location_col).agg({
        'total': 'sum', 'customer_email': 'nunique', 'order_id': 'nunique'
    }).reset_index().sort_values('total', ascending=False)

    data = []
    for _, row in geo.iterrows():
        data.append({
            "location": str(row[location_col]),
            "total_revenue": float(row['total']),
            "unique_customers": int(row['customer_email']),
            "total_orders": int(row['order_id']),
            "avg_revenue_per_customer": float(row['total'] / row['customer_email']) if row['customer_email'] > 0 else 0.0
        })

    return {"location_column": location_col, "total_locations": len(data), "data": data[:20]}


def compute_order_volume_trends(df: pd.DataFrame, period: str = "monthly") -> dict:
    """Replicate /api/analytics/order-volume-trends."""
    if 'order_date' not in df.columns:
        return {"error": "order_date column required", "data": []}

    df = df.copy()
    df['order_date'] = pd.to_datetime(df['order_date'], errors='coerce')
    valid = df[df['order_date'].notna()].copy()

    if period == "daily":
        valid['period'] = valid['order_date'].dt.date
    elif period == "weekly":
        valid['period'] = valid['order_date'].dt.to_period('W').dt.start_time.dt.date
    else:
        valid['period'] = valid['order_date'].dt.to_period('M')

    if 'quantity' in valid.columns:
        trends = valid.groupby('period').agg({'order_id': 'nunique', 'quantity': 'sum'}).reset_index()
        trends['avg_items_per_order'] = trends['quantity'] / trends['order_id']
    else:
        trends = valid.groupby('period').agg({'order_id': 'nunique'}).reset_index()
        trends['quantity'] = 0
        trends['avg_items_per_order'] = 0

    trends['period_str'] = trends['period'].astype(str)
    trends = trends.sort_values('period')
    trends['volume_change'] = trends['order_id'].pct_change() * 100

    data = []
    for _, row in trends.iterrows():
        data.append({
            "period": row['period_str'],
            "order_count": int(row['order_id']),
            "total_items": int(row['quantity']),
            "avg_items_per_order": float(row['avg_items_per_order']),
            "change_percent": float(row['volume_change']) if pd.notna(row['volume_change']) else 0.0
        })

    return {"period_type": period, "has_quantity_data": 'quantity' in df.columns, "data": data}


def compute_revenue_per_customer(df: pd.DataFrame) -> dict:
    """Replicate /api/analytics/revenue-per-customer."""
    if any(c not in df.columns for c in ['customer_email', 'total']):
        return {"error": "Missing required columns", "data": []}

    stats = df.groupby('customer_email').agg({
        'total': 'sum',
        'order_id': 'nunique',
        'order_date': ['min', 'max']
    }).reset_index()
    stats.columns = ['customer_email', 'total_revenue', 'total_orders', 'first_order', 'last_order']
    stats['first_order'] = pd.to_datetime(stats['first_order'], errors='coerce')
    stats['last_order'] = pd.to_datetime(stats['last_order'], errors='coerce')
    stats['lifetime_days'] = (stats['last_order'] - stats['first_order']).dt.days + 1
    stats['lifetime_days'] = stats['lifetime_days'].fillna(1)
    stats['revenue_per_order'] = stats['total_revenue'] / stats['total_orders']

    try:
        stats['revenue_quartile'] = pd.qcut(stats['total_revenue'], q=4,
                                            labels=['Low', 'Medium', 'High', 'Premium'],
                                            duplicates='drop')
    except ValueError:
        stats['revenue_quartile'] = 'All'

    total_customers = len(stats)
    total_revenue = float(stats['total_revenue'].sum())

    segments_data = []
    if stats['revenue_quartile'].nunique() > 1:
        seg = stats.groupby('revenue_quartile').agg({
            'customer_email': 'count',
            'total_revenue': ['mean', 'sum'],
            'total_orders': 'mean',
            'revenue_per_order': 'mean',
            'lifetime_days': 'mean'
        }).reset_index()
        seg.columns = ['segment', 'customer_count', 'avg_revenue', 'total_segment_revenue',
                       'avg_orders', 'avg_revenue_per_order', 'avg_lifetime_days']
        for _, row in seg.iterrows():
            segments_data.append({
                "segment": str(row['segment']),
                "customer_count": int(row['customer_count']),
                "avg_revenue_per_customer": float(row['avg_revenue']),
                "total_segment_revenue": float(row['total_segment_revenue']),
                "avg_orders_per_customer": float(row['avg_orders']),
                "avg_revenue_per_order": float(row['avg_revenue_per_order']),
                "avg_customer_lifetime_days": float(row['avg_lifetime_days'])
            })

    top = stats.nlargest(10, 'total_revenue')
    top_customers = []
    for _, row in top.iterrows():
        top_customers.append({
            "customer_email": str(row['customer_email']),
            "total_revenue": float(row['total_revenue']),
            "total_orders": int(row['total_orders']),
            "revenue_per_order": float(row['revenue_per_order']),
            "lifetime_days": int(row['lifetime_days']) if pd.notna(row['lifetime_days']) else 1
        })

    return {
        "summary": {
            "total_customers": total_customers,
            "total_revenue": total_revenue,
            "avg_revenue_per_customer": total_revenue / total_customers if total_customers else 0.0,
            "avg_orders_per_customer": float(stats['total_orders'].mean()),
            "avg_revenue_per_order": float(stats['revenue_per_order'].mean())
        },
        "segments": segments_data,
        "top_customers": top_customers,
        "has_date_data": 'order_date' in df.columns
    }


def main():
    print("=== StrategIQ Baseline Test Runner ===")
    print(f"CSV: {CSV_PATH}")

    # Step 1: Run through the upload pipeline
    df = run_pipeline(CSV_PATH)

    # Step 2: Core metrics (AnalyticsService)
    analytics = AnalyticsService(df)
    metrics = analytics.compute_metrics()

    core_metrics = {
        "total_revenue": make_json_safe(metrics.total_revenue),
        "active_customers": make_json_safe(metrics.active_customers),
        "avg_order_value": make_json_safe(metrics.avg_order_value),
        "churn_risk_percentage": make_json_safe(metrics.churn_risk_percentage),
        "revenue_forecast": make_json_safe(metrics.revenue_forecast),
        "customer_segments": [
            {
                "name": s.name,
                "color": s.color,
                "customers": make_json_safe(s.customers),
                "total_revenue": make_json_safe(s.total_revenue),
                "avg_revenue": make_json_safe(s.avg_revenue)
            }
            for s in metrics.customer_segments
        ]
    }

    # Step 3: All 6 analytics endpoint outputs
    top_products_revenue = compute_top_products(df, sort_by="revenue")
    top_products_volume = compute_top_products(df, sort_by="volume")
    revenue_trends = compute_revenue_trends(df, period="monthly")
    aov_trends = compute_aov_trends(df, period="monthly")
    customer_analysis = compute_customer_analysis(df)
    geographic_analysis = compute_geographic_analysis(df)
    order_volume_trends = compute_order_volume_trends(df, period="monthly")
    revenue_per_customer = compute_revenue_per_customer(df)

    # Step 4: Data overview (matches data-insights-check)
    data_overview = {
        "total_rows": len(df),
        "columns_available": list(df.columns),
        "unique_customers": int(df['customer_email'].nunique()) if 'customer_email' in df.columns else 0,
        "unique_orders": int(df['order_id'].nunique()) if 'order_id' in df.columns else 0,
        "unique_products": int(df['product_name'].nunique()) if 'product_name' in df.columns else 0
    }

    # Assemble final output
    output = {
        "generated_at": pd.Timestamp.now().isoformat(),
        "source_csv": str(CSV_PATH.name),
        "pipeline_version": "v1",
        "data_overview": data_overview,
        "core_metrics": core_metrics,
        "top_products_by_revenue": make_json_safe(top_products_revenue),
        "top_products_by_volume": make_json_safe(top_products_volume),
        "revenue_trends_monthly": make_json_safe(revenue_trends),
        "aov_trends_monthly": make_json_safe(aov_trends),
        "customer_analysis": make_json_safe(customer_analysis),
        "geographic_analysis": make_json_safe(geographic_analysis),
        "order_volume_trends_monthly": make_json_safe(order_volume_trends),
        "revenue_per_customer": make_json_safe(revenue_per_customer)
    }

    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2, default=str)

    print(f"\n=== Results ===")
    print(f"Total revenue:    {output['core_metrics']['total_revenue']:.2f}")
    print(f"Active customers: {output['core_metrics']['active_customers']}")
    print(f"AOV:              {output['core_metrics']['avg_order_value']:.2f}")
    print(f"Churn risk:       {output['core_metrics']['churn_risk_percentage']:.1f}%")
    print(f"Segments:         {len(output['core_metrics']['customer_segments'])}")
    print(f"\nSaved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

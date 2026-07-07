import os
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env only (secrets stay out of repo root and out of Vite)
load_dotenv(Path(__file__).resolve().parent / ".env")

import asyncio
import difflib
import urllib.request

from fastapi import FastAPI, UploadFile, File, Form, Depends, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Any, List, Dict, Optional
from jose import jwt, jwk, JWTError
import pandas as pd
import numpy as np
import logging
from io import BytesIO
import json
from datetime import datetime

# Encodings to try, in order. utf-8-sig strips the BOM Shopify adds to
# "Plain CSV for Excel" exports; latin-1/cp1252 cover Windows-exported files.
_CSV_ENCODINGS = ("utf-8-sig", "utf-8", "latin-1", "cp1252")


def _read_csv_robust(content: bytes, **kwargs) -> pd.DataFrame:
    """Try common encodings until one parses successfully."""
    last_exc: Exception | None = None
    for enc in _CSV_ENCODINGS:
        try:
            return pd.read_csv(BytesIO(content), encoding=enc, **kwargs)
        except Exception as exc:
            last_exc = exc
    raise last_exc  # re-raise the last failure so callers can log it

# Import our updated services
from utils.validators import REQUIRED_COLUMNS, validate_dataframes, find_matching_column, COLUMN_MAPPINGS
from services.data_cleaner import DataCleaner
from services.analytics import AnalyticsService
from services.file_processor import file_processor
from core_config import validate_core_config, CORE_VERSION

# Shared auth and state (imported here so the v2 router can import without circular refs)
from shared.auth import require_auth as _require_auth_shared
from shared.state import _user_data as _shared_user_data, _user_sample_mode

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# CRITICAL: Validate core configuration on startup
try:
    validate_core_config()
    logger.info(f"✅ Core data processing pipeline validated (v{CORE_VERSION})")
except Exception as e:
    logger.error(f"❌ CRITICAL: Core configuration validation failed: {e}")
    raise SystemExit("System cannot start - core configuration corrupted")

# ── Auth ──────────────────────────────────────────────────────────────────────
# require_auth lives in shared/auth.py so the v2 router can import it without
# creating a circular dependency. This alias preserves backward compatibility
# with all existing usages in this file.
require_auth = _require_auth_shared

# Per-user in-memory data store — shared with the v2 router via shared/state.py.
_user_data = _shared_user_data


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="StrategIQ Analytics API",
    description="API for processing and analyzing Shopify and e-commerce data",
    version="1.0.0"
)

# Analytics endpoints moved inline to avoid import overhead

# Configure CORS
_allowed_origins = [
    "http://localhost:5173",
    "http://localhost:5189",
]
_frontend_url = os.environ.get("FRONTEND_URL", "")
if _frontend_url:
    _allowed_origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# v2 upload router (Excel, persistent storage, history, validation, sample data)
from routes.upload_v2 import router as _upload_v2_router
app.include_router(_upload_v2_router, prefix="/api/upload/v2")

def standardize_columns(df):
    """Standardize column names for consistent processing."""
    df.columns = (
        df.columns.str.strip()
        .str.lower()
        .str.replace(" ", "_")
        .str.replace("-", "_")
    )
    return df

def make_json_safe(obj):
    """Convert any object to be JSON serializable."""
    if isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating,)):
        if np.isnan(obj) or np.isinf(obj):
            return 0.0
        return float(obj)
    elif isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return 0.0
        return obj
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (datetime, pd.Timestamp)):
        return obj.isoformat() if pd.notna(obj) else None
    elif isinstance(obj, dict):
        return {key: make_json_safe(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [make_json_safe(item) for item in obj]
    elif pd.isna(obj):
        return None
    else:
        return obj

def safe_divide(numerator, denominator):
    """Safely divide two numbers, handling edge cases."""
    try:
        if denominator == 0 or pd.isna(denominator) or pd.isna(numerator):
            return 0.0
        result = float(numerator) / float(denominator)
        if np.isnan(result) or np.isinf(result):
            return 0.0
        return result
    except (ValueError, TypeError, ZeroDivisionError):
        return 0.0

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "message": "StrategIQ Analytics API is running"}

@app.get("/")
async def root():
    return {"message": "Welcome to StrategIQ Analytics API"}


@app.delete("/api/auth/account")
async def delete_account(_user: dict = Depends(require_auth)):
    """
    Delete the calling user's Supabase auth record.
    Requires SUPABASE_SERVICE_ROLE_KEY — must only ever run server-side.
    The profile row is deleted client-side first (RLS allows it); this
    endpoint removes the auth.users record so the email can be reused.
    """
    user_id = _user.get("sub", "")
    if not user_id:
        raise HTTPException(status_code=400, detail="Could not identify user from token.")

    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    supabase_url = os.environ.get("SUPABASE_URL", "")
    if not service_role_key or not supabase_url:
        raise HTTPException(
            status_code=501,
            detail="Account deletion is not configured on this server. Contact support.",
        )

    url = f"{supabase_url.rstrip('/')}/auth/v1/admin/users/{user_id}"
    req = urllib.request.Request(url, method="DELETE")
    req.add_header("Authorization", f"Bearer {service_role_key}")
    req.add_header("apikey", service_role_key)

    try:
        with urllib.request.urlopen(req, timeout=10):
            pass
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        logger.error(f"Supabase user deletion failed: {e.code} {body}")
        raise HTTPException(status_code=500, detail="Failed to delete account. Please try again.")

    # Clear any in-memory data for this user
    _user_data.pop(user_id, None)
    logger.info(f"Account deleted for user {user_id}")
    return {"success": True}


# ============ ANALYTICS ENDPOINTS (Inline to avoid import overhead) ============

@app.get("/api/analytics/top-products")
async def get_top_products(
    limit: int = 10,
    sort_by: str = "revenue",
    _user: dict = Depends(require_auth),
):
    """Get top products by revenue or volume"""
    try:
        user_id = _user.get('sub', '')
        df = _user_data.get(user_id)
        if df is None:
            return {"error": "No sales data available", "data": []}
        required_cols = ['product_name', 'total', 'quantity']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            return {"error": f"Missing columns: {missing_cols}", "data": []}
        
        # Group by product and calculate metrics
        product_stats = df.groupby('product_name').agg({
            'total': 'sum',
            'quantity': 'sum',
            'order_id': 'nunique',
            'unit_price': 'mean'
        }).reset_index()
        
        # Sort by specified metric
        if sort_by == "volume":
            product_stats = product_stats.sort_values('quantity', ascending=False)
        else:
            product_stats = product_stats.sort_values('total', ascending=False)
        
        # Limit results and format
        top_products = product_stats.head(limit)
        products_data = []
        for _, row in top_products.iterrows():
            products_data.append({
                "product_name": row['product_name'],
                "total_revenue": float(row['total']),
                "total_quantity": int(row['quantity']),
                "unique_orders": int(row['order_id']),
                "avg_unit_price": float(row['unit_price']) if pd.notna(row['unit_price']) else 0.0,
                "revenue_per_unit": float(row['total'] / row['quantity']) if row['quantity'] > 0 else 0.0
            })
        
        return {"sort_by": sort_by, "total_products": len(product_stats), "data": products_data}
    except Exception as e:
        return {"error": str(e), "data": []}


@app.get("/api/analytics/revenue-trends")
async def get_revenue_trends(
    period: str = "monthly",
    _user: dict = Depends(require_auth),
):
    """Get revenue trends over time"""
    try:
        user_id = _user.get('sub', '')
        df = _user_data.get(user_id)
        if df is None:
            return {"error": "No sales data available", "data": []}
        if 'order_date' not in df.columns or 'total' not in df.columns:
            return {"error": "Required columns missing", "data": []}
        
        # Convert order_date to datetime
        df['order_date'] = pd.to_datetime(df['order_date'], errors='coerce')
        valid_data = df[df['order_date'].notna()].copy()
        
        if len(valid_data) == 0:
            return {"error": "No valid date data", "data": []}
        
        # Aggregate based on period
        if period == "daily":
            valid_data['period'] = valid_data['order_date'].dt.date
        elif period == "weekly":
            valid_data['period'] = valid_data['order_date'].dt.to_period('W').dt.start_time.dt.date
        else:  # monthly
            valid_data['period'] = valid_data['order_date'].dt.to_period('M')
        
        # Group by period and calculate revenue
        revenue_trends = valid_data.groupby('period').agg({
            'total': 'sum',
            'order_id': 'nunique'
        }).reset_index()
        
        revenue_trends['period_str'] = revenue_trends['period'].astype(str)
        revenue_trends = revenue_trends.sort_values('period')
        revenue_trends['revenue_change'] = revenue_trends['total'].pct_change() * 100
        
        # Format response
        trends_data = []
        for _, row in revenue_trends.iterrows():
            trends_data.append({
                "period": row['period_str'],
                "revenue": float(row['total']),
                "orders": int(row['order_id']),
                "change_percent": float(row['revenue_change']) if not pd.isna(row['revenue_change']) else 0.0
            })
        
        return {"period_type": period, "total_periods": len(trends_data), "data": trends_data}
    except Exception as e:
        return {"error": str(e), "data": []}


@app.get("/api/analytics/aov-trends")
async def get_aov_trends(
    period: str = "monthly",
    _user: dict = Depends(require_auth),
):
    """Get Average Order Value trends"""
    try:
        user_id = _user.get('sub', '')
        df = _user_data.get(user_id)
        if df is None:
            return {"error": "No sales data available", "data": []}
        if 'order_date' not in df.columns or 'total' not in df.columns or 'order_id' not in df.columns:
            return {"error": "Required columns missing", "data": []}
        
        df['order_date'] = pd.to_datetime(df['order_date'], errors='coerce')
        valid_data = df[df['order_date'].notna()].copy()
        
        if len(valid_data) == 0:
            return {"error": "No valid date data", "data": []}
        
        # Aggregate based on period
        if period == "daily":
            valid_data['period'] = valid_data['order_date'].dt.date
        elif period == "weekly":
            valid_data['period'] = valid_data['order_date'].dt.to_period('W').dt.start_time.dt.date
        else:
            valid_data['period'] = valid_data['order_date'].dt.to_period('M')
        
        # Calculate AOV by period
        aov_trends = valid_data.groupby('period').agg({
            'total': 'sum',
            'order_id': 'nunique'
        }).reset_index()
        
        aov_trends['aov'] = aov_trends['total'] / aov_trends['order_id']
        aov_trends['period_str'] = aov_trends['period'].astype(str)
        aov_trends = aov_trends.sort_values('period')
        aov_trends['aov_change'] = aov_trends['aov'].pct_change() * 100
        
        aov_data = []
        for _, row in aov_trends.iterrows():
            aov_data.append({
                "period": row['period_str'],
                "aov": float(row['aov']),
                "total_revenue": float(row['total']),
                "total_orders": int(row['order_id']),
                "change_percent": float(row['aov_change']) if pd.notna(row['aov_change']) else 0.0
            })
        
        return {"period_type": period, "data": aov_data}
    except Exception as e:
        return {"error": str(e), "data": []}


@app.get("/api/analytics/customer-analysis")
async def get_customer_analysis(
    _user: dict = Depends(require_auth),
):
    """Analyze returning vs new customers"""
    try:
        user_id = _user.get('sub', '')
        df = _user_data.get(user_id)
        if df is None:
            return {"error": "No sales data available", "data": []}
        if 'customer_email' not in df.columns or 'order_date' not in df.columns:
            return {"error": "Required columns missing", "data": []}
        
        df['order_date'] = pd.to_datetime(df['order_date'], errors='coerce')
        valid_data = df[df['order_date'].notna()].copy()
        
        if len(valid_data) == 0:
            return {"error": "No valid date data", "data": []}
        
        # Get first order date for each customer
        customer_first_orders = valid_data.groupby('customer_email')['order_date'].min().reset_index()
        customer_first_orders.columns = ['customer_email', 'first_order_date']
        
        # Merge back with original data
        analysis_data = valid_data.merge(customer_first_orders, on='customer_email')
        analysis_data['order_period'] = analysis_data['order_date'].dt.to_period('M')
        analysis_data['first_order_period'] = analysis_data['first_order_date'].dt.to_period('M')
        
        # Classify customers
        analysis_data['customer_type'] = analysis_data.apply(
            lambda row: 'New' if row['order_period'] == row['first_order_period'] else 'Returning',
            axis=1
        )
        
        # Group by period and customer type
        customer_trends = analysis_data.groupby(['order_period', 'customer_type']).agg({
            'customer_email': 'nunique',
            'total': 'sum'
        }).reset_index()
        
        # Format response data
        analysis_result = []
        periods = customer_trends['order_period'].unique()
        
        for period in periods:
            period_data = customer_trends[customer_trends['order_period'] == period]
            new_data = period_data[period_data['customer_type'] == 'New']
            returning_data = period_data[period_data['customer_type'] == 'Returning']
            
            new_customers = int(new_data['customer_email'].sum()) if len(new_data) > 0 else 0
            returning_customers = int(returning_data['customer_email'].sum()) if len(returning_data) > 0 else 0
            total_customers = new_customers + returning_customers
            
            analysis_result.append({
                "period": str(period),
                "new_customers": new_customers,
                "returning_customers": returning_customers,
                "total_customers": total_customers,
                "new_customer_revenue": float(new_data['total'].sum()) if len(new_data) > 0 else 0.0,
                "returning_customer_revenue": float(returning_data['total'].sum()) if len(returning_data) > 0 else 0.0,
                "returning_percentage": (returning_customers / total_customers * 100) if total_customers > 0 else 0
            })
        
        return {"data": analysis_result}
    except Exception as e:
        return {"error": str(e), "data": []}


@app.get("/api/analytics/geographic-analysis")
async def get_geographic_analysis(
    _user: dict = Depends(require_auth),
):
    """Get geographic distribution of customers (if location data is available)"""
    try:
        user_id = _user.get('sub', '')
        df = _user_data.get(user_id)
        if df is None:
            return {"error": "No sales data available", "data": []}
        
        # Check if location column exists
        location_col = None
        for col in ['customer_location', 'city', 'location', 'billing_city', 'shipping_city', 'billing_address', 'shipping_address']:
            if col in df.columns:
                location_col = col
                break
        
        if location_col is None:
            # Check if we have any column that might contain location data
            location_candidates = [col for col in df.columns if any(keyword in col.lower() for keyword in ['city', 'location', 'address', 'state', 'country', 'region'])]
            if location_candidates:
                location_col = location_candidates[0]  # Use first candidate
            else:
                return {"error": "No location data found in uploaded files", "data": [], "available_columns": list(df.columns)}
        
        # Group by location and calculate metrics
        geo_stats = df.groupby(location_col).agg({
            'total': 'sum',
            'customer_email': 'nunique',
            'order_id': 'nunique'
        }).reset_index()
        
        # Sort by revenue
        geo_stats = geo_stats.sort_values('total', ascending=False)
        
        # Format response
        geo_data = []
        for _, row in geo_stats.iterrows():
            geo_data.append({
                "location": str(row[location_col]),
                "total_revenue": float(row['total']),
                "unique_customers": int(row['customer_email']),
                "total_orders": int(row['order_id']),
                "avg_revenue_per_customer": float(row['total'] / row['customer_email']) if row['customer_email'] > 0 else 0.0
            })
        
        return {
            "location_column": location_col,
            "total_locations": len(geo_data),
            "data": geo_data[:20]  # Limit to top 20 locations
        }
        
    except Exception as e:
        return {"error": str(e), "data": [], "available_columns": list(df.columns) if 'df' in locals() else []}


@app.get("/api/analytics/order-volume-trends")
async def get_order_volume_trends(
    period: str = "monthly",
    _user: dict = Depends(require_auth),
):
    """Get order volume trends (number of items per order over time)"""
    try:
        user_id = _user.get('sub', '')
        df = _user_data.get(user_id)
        if df is None:
            return {"error": "No sales data available", "data": []}
        
        # Check required columns
        if 'order_date' not in df.columns:
            return {"error": "order_date column required", "data": [], "available_columns": list(df.columns)}
        
        # Convert order_date to datetime
        df['order_date'] = pd.to_datetime(df['order_date'], errors='coerce')
        valid_data = df[df['order_date'].notna()].copy()
        
        if len(valid_data) == 0:
            return {"error": "No valid date data", "data": []}
        
        # Aggregate based on period
        if period == "daily":
            valid_data['period'] = valid_data['order_date'].dt.date
        elif period == "weekly":
            valid_data['period'] = valid_data['order_date'].dt.to_period('W').dt.start_time.dt.date
        else:  # monthly
            valid_data['period'] = valid_data['order_date'].dt.to_period('M')
        
        # Calculate volume metrics by period
        if 'quantity' in valid_data.columns:
            # Count total items and unique orders
            volume_trends = valid_data.groupby('period').agg({
                'order_id': 'nunique',
                'quantity': 'sum'
            }).reset_index()
            volume_trends['avg_items_per_order'] = volume_trends['quantity'] / volume_trends['order_id']
        else:
            # Just count orders if quantity not available
            volume_trends = valid_data.groupby('period').agg({
                'order_id': 'nunique'
            }).reset_index()
            volume_trends['quantity'] = 0
            volume_trends['avg_items_per_order'] = 0
        
        # Convert period to string for JSON serialization
        volume_trends['period_str'] = volume_trends['period'].astype(str)
        volume_trends = volume_trends.sort_values('period')
        volume_trends['volume_change'] = volume_trends['order_id'].pct_change() * 100
        
        # Format response
        volume_data = []
        for _, row in volume_trends.iterrows():
            volume_data.append({
                "period": row['period_str'],
                "order_count": int(row['order_id']),
                "total_items": int(row['quantity']) if 'quantity' in volume_trends.columns else 0,
                "avg_items_per_order": float(row['avg_items_per_order']) if 'avg_items_per_order' in volume_trends.columns else 0.0,
                "change_percent": float(row['volume_change']) if pd.notna(row['volume_change']) else 0.0
            })
        
        return {
            "period_type": period,
            "has_quantity_data": 'quantity' in df.columns,
            "data": volume_data
        }
        
    except Exception as e:
        return {"error": str(e), "data": [], "available_columns": list(df.columns) if 'df' in locals() else []}


@app.get("/api/analytics/revenue-per-customer")
async def get_revenue_per_customer(
    _user: dict = Depends(require_auth),
):
    """Get detailed revenue per customer analysis with segmentation"""
    try:
        user_id = _user.get('sub', '')
        df = _user_data.get(user_id)
        if df is None:
            return {"error": "No sales data available", "data": []}
        
        # Check required columns
        required_cols = ['customer_email', 'total']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            return {"error": f"Missing required columns: {missing_cols}", "data": [], "available_columns": list(df.columns)}
        
        # Calculate customer metrics
        customer_stats = df.groupby('customer_email').agg({
            'total': 'sum',
            'order_id': 'nunique',
            'order_date': ['min', 'max'] if 'order_date' in df.columns else 'count'
        }).reset_index()
        
        # Handle column names based on available data
        if 'order_date' in df.columns:
            customer_stats.columns = ['customer_email', 'total_revenue', 'total_orders', 'first_order', 'last_order']
            
            # Convert dates and calculate customer lifetime
            customer_stats['first_order'] = pd.to_datetime(customer_stats['first_order'], errors='coerce')
            customer_stats['last_order'] = pd.to_datetime(customer_stats['last_order'], errors='coerce')
            customer_stats['lifetime_days'] = (customer_stats['last_order'] - customer_stats['first_order']).dt.days + 1
            customer_stats['lifetime_days'] = customer_stats['lifetime_days'].fillna(1)  # Single purchase = 1 day
        else:
            customer_stats.columns = ['customer_email', 'total_revenue', 'total_orders', 'order_count']
            customer_stats['lifetime_days'] = 1  # Default if no date data
        
        # Calculate revenue per order
        customer_stats['revenue_per_order'] = customer_stats['total_revenue'] / customer_stats['total_orders']
        
        # Create customer segments based on revenue (quartiles)
        try:
            customer_stats['revenue_quartile'] = pd.qcut(customer_stats['total_revenue'], 
                                                       q=4, labels=['Low', 'Medium', 'High', 'Premium'], duplicates='drop')
        except ValueError:
            # If not enough unique values for quartiles, create simple segments
            customer_stats['revenue_quartile'] = 'All'
        
        # Calculate overall metrics
        total_customers = len(customer_stats)
        total_revenue = customer_stats['total_revenue'].sum()
        avg_revenue_per_customer = total_revenue / total_customers if total_customers > 0 else 0
        
        # Segment analysis (only if we have proper quartiles)
        segments_data = []
        if customer_stats['revenue_quartile'].nunique() > 1:
            segment_analysis = customer_stats.groupby('revenue_quartile').agg({
                'customer_email': 'count',
                'total_revenue': ['mean', 'sum'],
                'total_orders': 'mean',
                'revenue_per_order': 'mean',
                'lifetime_days': 'mean'
            }).reset_index()
            
            # Flatten column names
            segment_analysis.columns = ['segment', 'customer_count', 'avg_revenue', 'total_segment_revenue', 
                                      'avg_orders', 'avg_revenue_per_order', 'avg_lifetime_days']
            
            # Format segment data
            for _, row in segment_analysis.iterrows():
                segments_data.append({
                    "segment": str(row['segment']),
                    "customer_count": int(row['customer_count']),
                    "avg_revenue_per_customer": float(row['avg_revenue']),
                    "total_segment_revenue": float(row['total_segment_revenue']),
                    "avg_orders_per_customer": float(row['avg_orders']),
                    "avg_revenue_per_order": float(row['avg_revenue_per_order']),
                    "avg_customer_lifetime_days": float(row['avg_lifetime_days'])
                })
        
        # Top customers
        top_customers = customer_stats.nlargest(10, 'total_revenue')
        top_customers_data = []
        for _, row in top_customers.iterrows():
            top_customers_data.append({
                "customer_email": str(row['customer_email']),
                "total_revenue": float(row['total_revenue']),
                "total_orders": int(row['total_orders']),
                "revenue_per_order": float(row['revenue_per_order']),
                "lifetime_days": int(row['lifetime_days']) if pd.notna(row['lifetime_days']) else 1
            })
        
        return {
            "summary": {
                "total_customers": total_customers,
                "total_revenue": float(total_revenue),
                "avg_revenue_per_customer": float(avg_revenue_per_customer),
                "avg_orders_per_customer": float(customer_stats['total_orders'].mean()),
                "avg_revenue_per_order": float(customer_stats['revenue_per_order'].mean())
            },
            "segments": segments_data,
            "top_customers": top_customers_data,
            "has_date_data": 'order_date' in df.columns
        }
        
    except Exception as e:
        return {"error": str(e), "data": [], "available_columns": list(df.columns) if 'df' in locals() else []}


@app.get("/api/analytics/data-insights-check")
async def check_data_insights_availability(
    _user: dict = Depends(require_auth),
):
    """Check if your data supports repeat purchase behavior and basket trends analysis"""
    try:
        user_id = _user.get('sub', '')
        if _user_data.get(user_id) is None:
            return {
                "error": "No sales data available",
                "message": "Please upload your data files first to see what advanced features are available.",
                "overall_recommendation": "📊 UPLOAD DATA: Upload your sales data to check available features",
                "features_available_count": 0,
                "repeat_purchase_analysis": {
                    "feature_name": "🔒 Repeat Purchase Behavior",
                    "available": False,
                    "recommendation": "Upload data to check availability"
                },
                "basket_trends_analysis": {
                    "feature_name": "🔒 Basket Trends",
                    "available": False,
                    "recommendation": "Upload data to check availability"
                },
                "data_overview": {
                    "total_rows": 0,
                    "columns_available": [],
                    "unique_customers": 0,
                    "unique_orders": 0,
                    "unique_products": 0
                }
            }
        
        df = _user_data[user_id]
        columns = list(df.columns)

        analysis_results = {
            "data_overview": {
                "total_rows": len(df),
                "columns_available": columns,
                "unique_customers": df['customer_email'].nunique() if 'customer_email' in columns else 0,
                "unique_orders": df['order_id'].nunique() if 'order_id' in columns else 0,
                "unique_products": df['product_name'].nunique() if 'product_name' in columns else 0
            }
        }
        
        # Check REPEAT PURCHASE BEHAVIOR requirements
        repeat_analysis = {
            "feature_name": "🔒 Repeat Purchase Behavior",
            "available": False,
            "requirements_met": {},
            "data_quality": {},
            "recommendation": ""
        }
        
        # Check required columns for repeat purchase
        repeat_required = ["customer_email", "order_date", "order_id"]
        repeat_missing = [col for col in repeat_required if col not in columns]
        
        if not repeat_missing:
            # All columns present, check data quality
            repeat_analysis["requirements_met"]["has_required_columns"] = True
            
            # Check if customers have multiple orders
            customer_order_counts = df.groupby('customer_email')['order_id'].nunique()
            repeat_customers = int((customer_order_counts > 1).sum())
            total_customers = len(customer_order_counts)
            avg_orders_per_customer = float(customer_order_counts.mean())
            
            repeat_analysis["data_quality"] = {
                "total_customers": total_customers,
                "customers_with_repeat_orders": repeat_customers,
                "repeat_customer_percentage": round(repeat_customers / total_customers * 100, 1) if total_customers > 0 else 0,
                "avg_orders_per_customer": round(avg_orders_per_customer, 2)
            }
            
            if int(repeat_customers) >= 5:  # Need at least 5 repeat customers for meaningful analysis
                repeat_analysis["available"] = True
                repeat_analysis["recommendation"] = f"✅ EXCELLENT! You have {repeat_customers} customers with multiple orders ({repeat_customers/total_customers*100:.1f}%). Perfect for repeat purchase analysis!"
            else:
                repeat_analysis["recommendation"] = f"⚠️ LIMITED: Only {repeat_customers} customers have multiple orders. Analysis possible but insights will be limited."
        else:
            repeat_analysis["requirements_met"]["missing_columns"] = repeat_missing
            repeat_analysis["recommendation"] = f"❌ MISSING: Need columns {repeat_missing} for repeat purchase analysis."
        
        # Check BASKET TRENDS (Market Basket Analysis) requirements
        basket_analysis = {
            "feature_name": "🔒 Basket Trends",
            "available": False,
            "requirements_met": {},
            "data_quality": {},
            "recommendation": ""
        }
        
        # Check required columns for basket analysis
        basket_required = ["order_id", "product_name"]
        basket_missing = [col for col in basket_required if col not in columns]
        
        if not basket_missing:
            # All columns present, check data quality
            basket_analysis["requirements_met"]["has_required_columns"] = True
            
            # Check orders with multiple products
            order_product_counts = df.groupby('order_id').size()
            multi_product_orders = int((order_product_counts > 1).sum())
            total_orders = len(order_product_counts)
            avg_products_per_order = float(order_product_counts.mean())
            
            basket_analysis["data_quality"] = {
                "total_orders": total_orders,
                "orders_with_multiple_products": multi_product_orders,
                "multi_product_percentage": round(multi_product_orders / total_orders * 100, 1) if total_orders > 0 else 0,
                "avg_products_per_order": round(avg_products_per_order, 2)
            }
            
            if int(multi_product_orders) >= 10:  # Need at least 10 multi-product orders
                basket_analysis["available"] = True
                basket_analysis["recommendation"] = f"✅ EXCELLENT! You have {multi_product_orders} orders with multiple products ({multi_product_orders/total_orders*100:.1f}%). Perfect for basket analysis!"
            else:
                basket_analysis["recommendation"] = f"⚠️ LIMITED: Only {multi_product_orders} orders have multiple products. Analysis possible but few bundle opportunities will be found."
        else:
            basket_analysis["requirements_met"]["missing_columns"] = basket_missing
            basket_analysis["recommendation"] = f"❌ MISSING: Need columns {basket_missing} for basket trends analysis."
        
        # Overall recommendation
        features_available = sum([repeat_analysis["available"], basket_analysis["available"]])
        
        if features_available == 2:
            overall_recommendation = "🎉 PERFECT! Your data supports BOTH advanced features. You can unlock deeper customer insights!"
        elif features_available == 1:
            overall_recommendation = "👍 GOOD! Your data supports 1 advanced feature. Some deeper insights available."
        else:
            overall_recommendation = "📊 BASIC: Your data supports overview analytics only. Advanced features need more data structure."
        
        return {
            "overall_recommendation": overall_recommendation,
            "features_available_count": features_available,
            "repeat_purchase_analysis": repeat_analysis,
            "basket_trends_analysis": basket_analysis,
            "data_overview": analysis_results["data_overview"]
        }
        
    except Exception as e:
        return {"error": str(e)} 
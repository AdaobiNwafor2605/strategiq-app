from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List
import pandas as pd
import numpy as np
import logging
from io import BytesIO
import json
from datetime import datetime

# Import our updated services
from utils.validators import REQUIRED_COLUMNS, validate_dataframes, find_matching_column, COLUMN_MAPPINGS
from services.data_cleaner import DataCleaner
from services.analytics import AnalyticsService
from services.file_processor import file_processor
from core_config import validate_core_config, CORE_VERSION

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

app = FastAPI(
    title="StrategIQ Analytics API",
    description="API for processing and analyzing Shopify and e-commerce data",
    version="1.0.0"
)

# Analytics endpoints moved inline to avoid import overhead

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5189", 
        "http://localhost:5190", 
        "http://localhost:5191",
        "http://localhost:3000"
    ],  # Multiple possible frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.post("/api/process-files")
async def process_files(files: List[UploadFile] = File(...)):
    """Process uploaded files and generate analytics."""
    if not files:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": {"message": "No files uploaded"}}
        )
    
    dataframes = []
    file_debug = []
    cleaner = DataCleaner()
    
    # Process each uploaded file
    for file in files:
        content = await file.read()
        try:
            # Read file based on extension
            if file.filename.endswith(".csv"):
                df = pd.read_csv(BytesIO(content))
            elif file.filename.endswith((".xlsx", ".xls")):
                df = pd.read_excel(BytesIO(content))
            else:
                return JSONResponse(
                    status_code=400,
                    content={"success": False, "error": {"message": f"Unsupported file type: {file.filename}. Please upload CSV or Excel files."}}
                )
            
            if df.empty:
                return JSONResponse(
                    status_code=400,
                    content={"success": False, "error": {"message": f"File {file.filename} is empty or contains no valid data."}}
                )
            
            # Create column mappings for this file
            column_mappings = {}
            for standard_col, possible_names in COLUMN_MAPPINGS.items():
                matched_col = find_matching_column(df, possible_names)
                if matched_col:
                    column_mappings[matched_col] = standard_col
            
            # Clean the dataframe
            df_cleaned = cleaner.clean_dataframe(df, column_mappings)
            dataframes.append(df_cleaned)
            
            # Create debug info (clean preview data for JSON serialization)
            preview_data = df_cleaned.head(3).copy()
            preview_data = preview_data.where(pd.notnull(preview_data), None)
            
            file_debug.append({
                "filename": file.filename,
                "columns": list(df_cleaned.columns),
                "head": preview_data.to_dict(orient="records"),
                "column_mappings": column_mappings
            })
            
            logger.info(f"Processed file: {file.filename} with {len(df_cleaned)} rows and columns: {list(df_cleaned.columns)}")
            
        except Exception as e:
            logger.error(f"Error processing {file.filename}: {str(e)}")
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": {"message": f"Failed to parse {file.filename}: {str(e)}. Please ensure the file is not corrupted and contains valid data."}}
            )

    if not dataframes:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": {"message": "No valid data found in uploaded files"}}
        )

    # Validate that required columns are present across all files
    df_dict = {f"file_{i}": df for i, df in enumerate(dataframes)}
    is_valid, validation_errors = validate_dataframes(df_dict)
    
    if not is_valid:
        missing_columns = []
        for error in validation_errors:
            missing_columns.extend(error.get("missing_columns", []))
        
        error_response = {
            "success": False,
            "error": {
                "message": "Missing required columns across all uploaded files",
                "details": {
                    "missing_columns": list(set(missing_columns)),
                    "file_debug": make_json_safe(file_debug),
                    "validation_errors": make_json_safe(validation_errors)
                }
            }
        }
        
        return JSONResponse(
            status_code=400,
            content=make_json_safe(error_response)
        )

    # Combine all dataframes for analytics
    try:
        combined = pd.concat(dataframes, ignore_index=True)
        logger.info(f"Combined dataframe shape: {combined.shape}")
        logger.info(f"Combined dataframe columns: {list(combined.columns)}")
        
        if len(combined) == 0:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": {"message": "No valid data found after cleaning and combining files"}}
            )
        
        # Store the combined data in file_processor for analytics endpoints
        file_processor.sales_data = combined
        
        # Generate analytics using the analytics service
        analytics = AnalyticsService(combined)
        metrics = analytics.compute_metrics()
        
        # Convert to dictionary for JSON response
        response_data = {
            "success": True,
            "metrics": {
                "total_revenue": make_json_safe(metrics.total_revenue),
                "active_customers": make_json_safe(metrics.active_customers),
                "average_order_value": make_json_safe(metrics.avg_order_value),
                "churn_risk": make_json_safe(metrics.churn_risk_percentage),
                "revenue_forecast": make_json_safe(metrics.revenue_forecast),
                "customer_segments": [
                    {
                        "name": segment.name,
                        "color": segment.color,
                        "customers": make_json_safe(segment.customers),
                        "total_revenue": make_json_safe(segment.total_revenue),
                        "avg_revenue": make_json_safe(segment.avg_revenue)
                    }
                    for segment in metrics.customer_segments
                ],
                "columns_found": list(combined.columns),
                "file_debug": make_json_safe(file_debug)
            }
        }
        
        # Final safety check - convert entire response to be JSON safe
        response_data = make_json_safe(response_data)
        
        return response_data
        
    except Exception as e:
        logger.error(f"Error generating analytics: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": {"message": f"Error processing data: {str(e)}"}}
        )

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "message": "StrategIQ Analytics API is running"}

@app.get("/")
async def root():
    return {"message": "Welcome to StrategIQ Analytics API"}


# ============ ANALYTICS ENDPOINTS (Inline to avoid import overhead) ============

@app.get("/api/analytics/top-products")
async def get_top_products(limit: int = 10, sort_by: str = "revenue"):
    """Get top products by revenue or volume"""
    try:
        if file_processor.sales_data is None:
            return {"error": "No sales data available", "data": []}
        
        df = file_processor.sales_data
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
async def get_revenue_trends(period: str = "monthly"):
    """Get revenue trends over time"""
    try:
        if file_processor.sales_data is None:
            return {"error": "No sales data available", "data": []}
        
        df = file_processor.sales_data
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
async def get_aov_trends(period: str = "monthly"):
    """Get Average Order Value trends"""
    try:
        if file_processor.sales_data is None:
            return {"error": "No sales data available", "data": []}
        
        df = file_processor.sales_data
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
async def get_customer_analysis():
    """Analyze returning vs new customers"""
    try:
        if file_processor.sales_data is None:
            return {"error": "No sales data available", "data": []}
        
        df = file_processor.sales_data
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


# Placeholder endpoints for other analytics features
@app.get("/api/analytics/geographic-analysis")
async def get_geographic_analysis():
    return {"error": "No location data available", "data": []}

@app.get("/api/analytics/order-volume-trends")
async def get_order_volume_trends(period: str = "monthly"):
    return {"error": "Feature coming soon", "data": []}

@app.get("/api/analytics/revenue-per-customer")
async def get_revenue_per_customer():
    return {"error": "Feature coming soon", "data": []} 
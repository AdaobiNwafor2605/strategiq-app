from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

router = APIRouter()

@router.get("/dashboard")
async def get_dashboard_metrics():
    """
    Get key metrics for the dashboard
    """
    try:
        # TODO: Replace with actual database queries
        return {
            "total_revenue": 142800,
            "active_customers": 6600,
            "avg_order_value": 89,
            "churn_risk": 8.2
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/segments")
async def get_customer_segments():
    """
    Get customer segmentation data
    """
    try:
        # TODO: Replace with actual segmentation logic
        return [
            {"name": "High-Value", "customers": 1200, "revenue": 45000},
            {"name": "Frequent Buyers", "customers": 2800, "revenue": 32000},
            {"name": "New Customers", "customers": 1800, "revenue": 18000},
            {"name": "At Risk", "customers": 800, "revenue": 8000}
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/forecast")
async def get_revenue_forecast():
    """
    Get revenue forecast data
    """
    try:
        # TODO: Replace with actual forecasting model
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
        return [
            {
                "month": month,
                "predicted": np.random.randint(35000, 55000),
                "actual": np.random.randint(32000, 50000) if i < 4 else None
            }
            for i, month in enumerate(months)
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/revenue-trends")
async def get_revenue_trends(period: str = "monthly"):
    """
    Get revenue trends over time with daily, weekly, or monthly aggregation
    """
    try:
        from services.file_processor import file_processor
        
        if file_processor.sales_data is None:
            return {"error": "No sales data available", "data": []}
        
        df = file_processor.sales_data
        
        # Ensure we have required columns
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
            period_format = "Daily"
        elif period == "weekly":
            valid_data['period'] = valid_data['order_date'].dt.to_period('W').dt.start_time.dt.date
            period_format = "Weekly"
        else:  # monthly
            valid_data['period'] = valid_data['order_date'].dt.to_period('M')
            period_format = "Monthly"
        
        # Group by period and calculate revenue
        revenue_trends = valid_data.groupby('period').agg({
            'total': 'sum',
            'order_id': 'nunique'  # Count unique orders
        }).reset_index()
        
        # Convert period to string for JSON serialization
        if period == "monthly":
            revenue_trends['period_str'] = revenue_trends['period'].astype(str)
        else:
            revenue_trends['period_str'] = revenue_trends['period'].astype(str)
        
        # Calculate period-over-period change
        revenue_trends = revenue_trends.sort_values('period')
        revenue_trends['revenue_change'] = revenue_trends['total'].pct_change() * 100
        
        # Format the response
        trends_data = []
        for _, row in revenue_trends.iterrows():
            trends_data.append({
                "period": row['period_str'],
                "revenue": float(row['total']),
                "orders": int(row['order_id']),
                "change_percent": float(row['revenue_change']) if not pd.isna(row['revenue_change']) else 0.0
            })
        
        return {
            "period_type": period_format,
            "total_periods": len(trends_data),
            "data": trends_data
        }
        
    except Exception as e:
        return {"error": str(e), "data": []}

@router.get("/top-products")
async def get_top_products(limit: int = 10, sort_by: str = "revenue"):
    """
    Get top products by revenue or volume
    """
    try:
        from services.file_processor import file_processor
        
        if file_processor.sales_data is None:
            return {"error": "No sales data available", "data": []}
        
        df = file_processor.sales_data
        
        # Ensure required columns exist
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
        
        # Calculate revenue per unit
        product_stats['revenue_per_unit'] = product_stats['total'] / product_stats['quantity']
        
        # Sort by specified metric
        if sort_by == "volume":
            product_stats = product_stats.sort_values('quantity', ascending=False)
        else:  # default to revenue
            product_stats = product_stats.sort_values('total', ascending=False)
        
        # Limit results
        top_products = product_stats.head(limit)
        
        # Format response
        products_data = []
        for _, row in top_products.iterrows():
            products_data.append({
                "product_name": row['product_name'],
                "total_revenue": float(row['total']),
                "total_quantity": int(row['quantity']),
                "unique_orders": int(row['order_id']),
                "avg_unit_price": float(row['unit_price']) if not pd.isna(row['unit_price']) else 0.0,
                "revenue_per_unit": float(row['revenue_per_unit']) if not pd.isna(row['revenue_per_unit']) else 0.0
            })
        
        return {
            "sort_by": sort_by,
            "total_products": len(product_stats),
            "data": products_data
        }
        
    except Exception as e:
        return {"error": str(e), "data": []}

@router.get("/aov-trends")
async def get_aov_trends(period: str = "monthly"):
    """
    Get Average Order Value trends over time
    """
    try:
        from services.file_processor import file_processor
        
        if file_processor.sales_data is None:
            return {"error": "No sales data available", "data": []}
        
        df = file_processor.sales_data
        
        # Ensure required columns exist
        if 'order_date' not in df.columns or 'total' not in df.columns or 'order_id' not in df.columns:
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
        
        # Calculate AOV by period (total revenue / unique orders)
        aov_trends = valid_data.groupby('period').agg({
            'total': 'sum',
            'order_id': 'nunique'
        }).reset_index()
        
        aov_trends['aov'] = aov_trends['total'] / aov_trends['order_id']
        
        # Convert period to string for JSON serialization
        aov_trends['period_str'] = aov_trends['period'].astype(str)
        
        # Calculate period-over-period change
        aov_trends = aov_trends.sort_values('period')
        aov_trends['aov_change'] = aov_trends['aov'].pct_change() * 100
        
        # Format response
        aov_data = []
        for _, row in aov_trends.iterrows():
            aov_data.append({
                "period": row['period_str'],
                "aov": float(row['aov']),
                "total_revenue": float(row['total']),
                "total_orders": int(row['order_id']),
                "change_percent": float(row['aov_change']) if not pd.isna(row['aov_change']) else 0.0
            })
        
        return {
            "period_type": period,
            "data": aov_data
        }
        
    except Exception as e:
        return {"error": str(e), "data": []}

@router.get("/customer-analysis")
async def get_customer_analysis():
    """
    Analyze returning vs new customers
    """
    try:
        from services.file_processor import file_processor
        
        if file_processor.sales_data is None:
            return {"error": "No sales data available", "data": []}
        
        df = file_processor.sales_data
        
        # Ensure required columns exist
        if 'customer_email' not in df.columns or 'order_date' not in df.columns:
            return {"error": "Required columns missing", "data": []}
        
        # Convert order_date to datetime
        df['order_date'] = pd.to_datetime(df['order_date'], errors='coerce')
        valid_data = df[df['order_date'].notna()].copy()
        
        if len(valid_data) == 0:
            return {"error": "No valid date data", "data": []}
        
        # Get first order date for each customer
        customer_first_orders = valid_data.groupby('customer_email')['order_date'].min().reset_index()
        customer_first_orders.columns = ['customer_email', 'first_order_date']
        
        # Merge back with original data
        analysis_data = valid_data.merge(customer_first_orders, on='customer_email')
        
        # Create monthly periods for analysis
        analysis_data['order_period'] = analysis_data['order_date'].dt.to_period('M')
        analysis_data['first_order_period'] = analysis_data['first_order_date'].dt.to_period('M')
        
        # Classify customers as new or returning for each period
        analysis_data['customer_type'] = analysis_data.apply(
            lambda row: 'New' if row['order_period'] == row['first_order_period'] else 'Returning',
            axis=1
        )
        
        # Group by period and customer type
        customer_trends = analysis_data.groupby(['order_period', 'customer_type']).agg({
            'customer_email': 'nunique',
            'total': 'sum'
        }).reset_index()
        
        # Pivot to get new vs returning columns
        customer_summary = customer_trends.pivot(
            index='order_period', 
            columns='customer_type', 
            values=['customer_email', 'total']
        ).fillna(0)
        
        # Flatten column names
        customer_summary.columns = [f"{col[1].lower()}_{col[0]}" for col in customer_summary.columns]
        customer_summary = customer_summary.reset_index()
        
        # Convert period to string for JSON serialization
        customer_summary['period'] = customer_summary['order_period'].astype(str)
        
        # Format response
        analysis_result = []
        for _, row in customer_summary.iterrows():
            new_customers = int(row.get('new_customer_email', 0))
            returning_customers = int(row.get('returning_customer_email', 0))
            total_customers = new_customers + returning_customers
            
            analysis_result.append({
                "period": row['period'],
                "new_customers": new_customers,
                "returning_customers": returning_customers,
                "total_customers": total_customers,
                "new_customer_revenue": float(row.get('new_total', 0)),
                "returning_customer_revenue": float(row.get('returning_total', 0)),
                "returning_percentage": (returning_customers / total_customers * 100) if total_customers > 0 else 0
            })
        
        return {
            "data": analysis_result
        }
        
    except Exception as e:
        return {"error": str(e), "data": []}

@router.get("/geographic-analysis")
async def get_geographic_analysis():
    """
    Get geographic distribution of customers (if location data is available)
    """
    try:
        from services.file_processor import file_processor
        
        if file_processor.sales_data is None:
            return {"error": "No sales data available", "data": []}
        
        df = file_processor.sales_data
        
        # Check if location column exists
        location_col = None
        for col in ['customer_location', 'city', 'location', 'billing_city', 'shipping_city']:
            if col in df.columns:
                location_col = col
                break
        
        if location_col is None:
            return {"error": "No location data available", "data": []}
        
        # Group by location
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
                "location": row[location_col],
                "total_revenue": float(row['total']),
                "unique_customers": int(row['customer_email']),
                "total_orders": int(row['order_id']),
                "avg_revenue_per_customer": float(row['total'] / row['customer_email']) if int(row['customer_email']) > 0 else 0.0
            })
        
        return {
            "location_column": location_col,
            "total_locations": len(geo_data),
            "data": geo_data
        }
        
    except Exception as e:
        return {"error": str(e), "data": []}

@router.get("/order-volume-trends")
async def get_order_volume_trends(period: str = "monthly"):
    """
    Get order volume trends over time
    """
    try:
        from services.file_processor import file_processor
        
        if file_processor.sales_data is None:
            return {"error": "No sales data available", "data": []}
        
        df = file_processor.sales_data
        
        # Ensure required columns exist
        if 'order_date' not in df.columns or 'order_id' not in df.columns:
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
        
        # Count unique orders by period
        volume_trends = valid_data.groupby('period').agg({
            'order_id': 'nunique',
            'quantity': 'sum'
        }).reset_index()
        
        # Convert period to string for JSON serialization
        volume_trends['period_str'] = volume_trends['period'].astype(str)
        
        # Calculate period-over-period change
        volume_trends = volume_trends.sort_values('period')
        volume_trends['volume_change'] = volume_trends['order_id'].pct_change() * 100
        
        # Format response
        volume_data = []
        for _, row in volume_trends.iterrows():
            volume_data.append({
                "period": row['period_str'],
                "order_count": int(row['order_id']),
                "total_items": int(row['quantity']) if pd.notna(row['quantity']) else 0,
                "change_percent": float(row['volume_change']) if not pd.isna(row['volume_change']) else 0.0
            })
        
        return {
            "period_type": period,
            "data": volume_data
        }
        
    except Exception as e:
        return {"error": str(e), "data": []}

@router.get("/revenue-per-customer")
async def get_revenue_per_customer():
    """
    Get revenue per customer analysis
    """
    try:
        from services.file_processor import file_processor
        
        if file_processor.sales_data is None:
            return {"error": "No sales data available", "data": []}
        
        df = file_processor.sales_data
        
        # Ensure required columns exist
        if 'customer_email' not in df.columns or 'total' not in df.columns:
            return {"error": "Required columns missing", "data": []}
        
        # Calculate customer metrics
        customer_stats = df.groupby('customer_email').agg({
            'total': 'sum',
            'order_id': 'nunique',
            'order_date': ['min', 'max']
        }).reset_index()
        
        # Flatten column names
        customer_stats.columns = ['customer_email', 'total_revenue', 'total_orders', 'first_order', 'last_order']
        
        # Convert dates
        customer_stats['first_order'] = pd.to_datetime(customer_stats['first_order'])
        customer_stats['last_order'] = pd.to_datetime(customer_stats['last_order'])
        
        # Calculate customer lifetime (in days)
        customer_stats['lifetime_days'] = (customer_stats['last_order'] - customer_stats['first_order']).dt.days + 1
        
        # Calculate revenue per order
        customer_stats['revenue_per_order'] = customer_stats['total_revenue'] / customer_stats['total_orders']
        
        # Create customer segments based on revenue
        try:
            customer_stats['revenue_quartile'] = pd.qcut(customer_stats['total_revenue'], 
                                                       q=4, labels=['Low', 'Medium', 'High', 'Premium'])
        except ValueError:
            # Handle case where there aren't enough unique values for quartiles
            customer_stats['revenue_quartile'] = 'All'
        
        # Segment analysis
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
        
        # Overall metrics
        total_customers = len(customer_stats)
        total_revenue = customer_stats['total_revenue'].sum()
        avg_revenue_per_customer = total_revenue / total_customers if total_customers > 0 else 0
        
        # Format segment data
        segments_data = []
        for _, row in segment_analysis.iterrows():
            segments_data.append({
                "segment": row['segment'],
                "customer_count": int(row['customer_count']),
                "avg_revenue_per_customer": float(row['avg_revenue']),
                "total_segment_revenue": float(row['total_segment_revenue']),
                "avg_orders_per_customer": float(row['avg_orders']),
                "avg_revenue_per_order": float(row['avg_revenue_per_order']),
                "avg_customer_lifetime_days": float(row['avg_lifetime_days']) if pd.notna(row['avg_lifetime_days']) else 0
            })
        
        return {
            "summary": {
                "total_customers": total_customers,
                "total_revenue": float(total_revenue),
                "avg_revenue_per_customer": float(avg_revenue_per_customer)
            },
            "segments": segments_data
        }
        
    except Exception as e:
        return {"error": str(e), "data": []}

# Revenue trends interfaces
interface RevenueTrendData {
  period: string;
  revenue: number;
  orders: number;
  change_percent: number;
}

interface RevenueTrendsResponse {
  period_type: string;
  total_periods: number;
  data: RevenueTrendData[];
} 
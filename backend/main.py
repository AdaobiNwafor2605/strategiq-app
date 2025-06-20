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

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5189"],  # Frontend URL
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
                        "segment": segment.name,
                        "count": make_json_safe(segment.count),
                        "avgSpend": make_json_safe(safe_divide(segment.revenue, segment.count))
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

@app.get("/")
async def root():
    return {"message": "Welcome to StrategIQ Analytics API"} 
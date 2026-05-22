from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import List, Dict, Any
import pandas as pd
import json
import logging
from io import StringIO, BytesIO
from services.file_processor import file_processor
from services.data_cleaner import DataCleaner
from services.analytics import AnalyticsService
from utils.validators import validate_dataframes, REQUIRED_COLUMNS
from models.schemas import ProcessingResponse, ProcessingError
from fastapi.responses import JSONResponse

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Store last analysis result for debugging
last_analysis_result: Dict[str, Any] = {}

def process_file(file: UploadFile, file_type: str, headers: List[str]) -> dict:
    """Process uploaded file based on its type"""
    try:
        # Read file content
        content = file.file.read()
        
        # Parse file based on extension
        if file.filename.endswith('.csv'):
            df = pd.read_csv(BytesIO(content))
        else:  # Excel file
            df = pd.read_excel(BytesIO(content))
        
        # Basic validation
        if df.empty:
            raise ValueError("File is empty")
            
        # Clean column names
        df.columns = df.columns.str.strip().str.lower()
        
        # Process based on file type
        if file_type == 'orders':
            required_cols = ['order', 'email', 'total', 'created at']
        elif file_type == 'products':
            required_cols = ['title', 'type', 'vendor', 'price']
        elif file_type == 'customers':
            required_cols = ['email', 'name', 'total spent']
        else:
            raise ValueError(f"Unsupported file type: {file_type}")
            
        # Verify required columns
        missing_cols = [col for col in required_cols 
                       if not any(existing.lower().replace(' ', '') == col.replace(' ', '')
                                for existing in df.columns)]
        
        if missing_cols:
            raise ValueError(f"Missing required columns: {', '.join(missing_cols)}")
            
        # Generate basic statistics
        stats = {
            "row_count": len(df),
            "column_count": len(df.columns),
            "columns": list(df.columns)
        }
        
        if 'total' in df.columns:
            stats["total_value"] = float(df['total'].sum())
            
        if 'created at' in df.columns:
            stats["date_range"] = {
                "start": df['created at'].min().strftime('%Y-%m-%d'),
                "end": df['created at'].max().strftime('%Y-%m-%-d')
            }
            
        return {
            "success": True,
            "file_type": file_type,
            "statistics": stats
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/")
async def upload_file(
    file: UploadFile = File(...),
    fileType: str = Form(...),
    headers: str = Form(...),
    analysis: str = Form(...)
):
    """
    Upload and process a file
    """
    try:
        # Parse JSON strings
        headers = json.loads(headers)
        analysis = json.loads(analysis)
        
        # Process the file
        result = process_file(file, fileType, headers)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/status")
async def get_upload_status():
    """
    Get the current status of uploaded files and available insights
    """
    return {
        "sales_data_available": file_processor.sales_data is not None,
        "products_data_available": file_processor.products_data is not None,
        "combined_insights_available": (
            file_processor.sales_data is not None and 
            file_processor.products_data is not None
        )
    }

async def read_file(file: UploadFile) -> pd.DataFrame:
    """Read CSV or Excel file into DataFrame."""
    try:
        content = await file.read()
        logger.info(f"Reading file: {file.filename}")
        
        if file.filename.endswith('.csv'):
            df = pd.read_csv(StringIO(content.decode('utf-8')))
        elif file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file format: {file.filename}")
        
        logger.info(f"Successfully read {file.filename} with shape: {df.shape}")
        logger.info(f"Columns found: {list(df.columns)}")
        return df
        
    except Exception as e:
        logger.error(f"Error reading file {file.filename}: {str(e)}")
        raise

def standardize_columns(df):
    df.columns = (
        df.columns.str.strip()
        .str.lower()
        .str.replace(" ", "_")
        .str.replace("-", "_")
    )
    return df

@router.post("/process-files")
async def process_files(files: List[UploadFile] = File(...)):
    dataframes = []
    file_debug = []
    for file in files:
        content = await file.read()
        try:
            if file.filename.endswith(".csv"):
                df = pd.read_csv(BytesIO(content))
            elif file.filename.endswith((".xlsx", ".xls")):
                df = pd.read_excel(BytesIO(content))
            else:
                return JSONResponse(
                    status_code=400,
                    content={"success": False, "error": f"Unsupported file type: {file.filename}"}
                )
            df = DataCleaner().clean_dataframe(df)
            dataframes.append(df)
            file_debug.append({
                "filename": file.filename,
                "columns": list(df.columns),
                "head": df.head(3).to_dict(orient="records")
            })
        except Exception as e:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": f"Failed to parse {file.filename}: {str(e)}"}
            )

    if not dataframes:
        return {"success": False, "error": "No valid files uploaded."}

    combined = pd.concat(dataframes, ignore_index=True)
    found_columns = set(combined.columns)
    metrics = {}
    warnings = []

    # Try to run all analytics, but skip if columns are missing
    try:
        analytics = AnalyticsService(combined)
        # Try each metric, catch and report if not possible
        try:
            metrics["total_revenue"] = analytics._calculate_total_revenue()
        except Exception:
            warnings.append("total_revenue: not enough data")
        try:
            metrics["active_customers"] = analytics._count_active_customers()
        except Exception:
            warnings.append("active_customers: not enough data")
        try:
            metrics["avg_order_value"] = analytics._calculate_aov()
        except Exception:
            warnings.append("avg_order_value: not enough data")
        try:
            metrics["churn_risk"] = analytics._calculate_churn_risk()
        except Exception:
            warnings.append("churn_risk: not enough data")
        try:
            metrics["revenue_forecast"] = analytics._forecast_revenue()
        except Exception:
            warnings.append("revenue_forecast: not enough data")
        try:
            metrics["customer_segments"] = analytics._segment_customers()
        except Exception:
            warnings.append("customer_segments: not enough data")
    except Exception as e:
        return {"success": False, "error": f"Analytics failed: {str(e)}"}

    return {
        "success": True,
        "metrics": metrics,
        "warnings": warnings,
        "columns_found": list(found_columns),
        "file_debug": file_debug
    }

@router.get("/debug/last-analysis")
async def get_last_analysis():
    """Debug endpoint to get the last analysis result"""
    return last_analysis_result

@router.get("/debug/column-check")
async def check_columns(file: UploadFile = File(...)):
    """Debug endpoint to check columns in a single file"""
    try:
        df = await read_file(file)
        return {
            "filename": file.filename,
            "columns": list(df.columns),
            "sample_data": df.head(5).to_dict(orient='records'),
            "dtypes": df.dtypes.astype(str).to_dict()
        }
    except Exception as e:
        return {"error": str(e)}


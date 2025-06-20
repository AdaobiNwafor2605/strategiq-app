from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from enum import Enum
from datetime import datetime

class FileType(str, Enum):
    CSV = "csv"
    EXCEL = "excel"

class ColumnMapping(BaseModel):
    file_column: str
    standard_column: str

class FileValidationError(BaseModel):
    file_name: str
    missing_columns: List[str]
    found_columns: List[str]

class ProcessingError(BaseModel):
    message: str
    details: Optional[Dict[str, List[str]]] = None

class CustomerSegment(BaseModel):
    name: str
    color: str
    customers: int
    total_revenue: float
    avg_revenue: float

class DashboardMetrics(BaseModel):
    total_revenue: float
    active_customers: int
    avg_order_value: float
    churn_risk_percentage: float
    revenue_forecast: List[Dict[str, Any]]  # Now includes period, display_name, revenue, and optional is_forecast
    customer_segments: List[CustomerSegment]

class ProcessingResponse(BaseModel):
    success: bool
    metrics: Optional[DashboardMetrics] = None
    error: Optional[ProcessingError] = None 
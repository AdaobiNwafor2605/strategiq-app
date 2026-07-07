"""
Customer insights and action summary API.
Mount point (set in main.py): /api/insights

GET /api/insights/customers      → customer-level data for the current user
GET /api/insights/action-summary → weekly grouped action summary
"""
import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from services.supabase_service import db_select
from shared.auth import require_auth

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/customers")
async def get_customer_insights(_user: dict = Depends(require_auth)):
    """Return the latest customer-level insight rows for the current user."""
    user_id = _user.get("sub")
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Unauthorised"})

    rows = db_select("customer_insights_cache", {"user_id": user_id}, order_by="generated_at.desc")
    if not rows:
        return JSONResponse(
            status_code=404,
            content={"error": "No customer insights found. Upload data first."},
        )

    record = rows[0]
    return {
        "success": True,
        "upload_id": record.get("upload_id"),
        "row_count": record.get("row_count", 0),
        "skipped_rows": record.get("skipped_rows", 0),
        "generated_at": record.get("generated_at"),
        "data": record.get("data_json", []),
    }


@router.get("/action-summary")
async def get_action_summary(_user: dict = Depends(require_auth)):
    """Return the latest weekly action summary for the current user."""
    user_id = _user.get("sub")
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Unauthorised"})

    rows = db_select("action_summary_cache", {"user_id": user_id}, order_by="generated_at.desc")
    if not rows:
        return JSONResponse(
            status_code=404,
            content={"error": "No action summary found. Upload data first."},
        )

    record = rows[0]
    return {
        "success": True,
        "upload_id": record.get("upload_id"),
        "generated_at": record.get("generated_at"),
        "summary": record.get("summary_json", {}),
    }

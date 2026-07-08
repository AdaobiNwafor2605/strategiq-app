"""
Customer insights API.
Mount point (set in main.py): /api/insights

GET  /customers           → all customers (for raw access)
GET  /action-summary      → weekly grouped action summary + segments + diff
GET  /bank                → full scored insight bank
GET  /action-state        → current mark-done/snooze state for user
POST /action-state        → update mark-done/snooze for an action
GET  /download/segment/{name}    → CSV of customers in that segment
GET  /download/action/{key}      → CSV of customers for that action group
GET  /download/insight/{id}      → CSV of customers for that insight
GET  /download/all               → ZIP of all three CSVs
"""
from __future__ import annotations

import csv
import io
import logging
import re
import zipfile
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse

from services.customer_insights import (
    INSIGHTS_PIPELINE_VERSION,
    compute_segments,
    refresh_customer_flags,
)
from services.supabase_service import db_select, db_upsert
from services.recommendation_serializer import growth_plan_json_to_action_groups
from shared.auth import require_auth
from shared.state import _user_active_upload_id, _user_session_insights

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _slugify(text: str) -> str:
    """Convert action name → URL-safe key (lowercase, hyphens)."""
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _fmt_date(iso: Optional[str]) -> str:
    if not iso:
        return ""
    try:
        return datetime.fromisoformat(iso).strftime("%d %b %Y")
    except Exception:
        return str(iso)


def _customer_key_col(record: Dict) -> str:
    return str(record.get("customer_email") or record.get("customer_id") or "")


def _customers_by_key(customers: List[Dict]) -> Dict[str, Dict]:
    return {_customer_key_col(c): c for c in customers if _customer_key_col(c)}


def _action_customer_ids(summary_json: Dict, action_key: str) -> List[str]:
    """Resolve customer IDs for an action from the Weekly Growth Plan when available."""
    plan = summary_json.get("weekly_growth_plan") or {}
    ids: List[str] = []
    for section in plan.get("sections", []):
        for action in section.get("actions", []):
            if _slugify(action.get("action", "")) == action_key:
                ids.extend(action.get("customer_ids") or [])
    return ids


def _filter_customers_by_action(
    customers: List[Dict],
    action_key: str,
    summary_json: Optional[Dict] = None,
) -> List[Dict]:
    """Match customers to an action via growth-plan IDs, then recommended_action slug."""
    by_key = _customers_by_key(customers)
    if summary_json:
        plan_ids = _action_customer_ids(summary_json, action_key)
        if plan_ids:
            matched = [by_key[cid] for cid in plan_ids if cid in by_key]
            if matched:
                return matched
    return [
        c for c in customers
        if _slugify(c.get("recommended_action", "")) == action_key
    ]


def _merge_segment_enrichment(
    computed: List[Dict],
    cached: List[Dict],
) -> List[Dict]:
    """Keep benchmark/trend metadata from cache; counts come from fresh computation."""
    by_name = {s.get("name"): s for s in cached if s.get("name")}
    merged: List[Dict] = []
    for seg in computed:
        name = seg.get("name", "")
        extra = by_name.get(name, {})
        merged.append({**extra, **seg})
    return merged


def _fetch_customers(user_id: str) -> List[Dict]:
    session = _user_session_insights.get(user_id)
    if session and session.get("customers"):
        return refresh_customer_flags(session["customers"])

    active_upload = _user_active_upload_id.get(user_id)
    rows = db_select("customer_insights_cache", {"user_id": user_id}, order_by="generated_at.desc")
    raw: List[Dict] = []
    if active_upload:
        for row in rows:
            if row.get("upload_id") == active_upload:
                raw = row.get("data_json") or []
                break
    if not raw and rows:
        raw = rows[0].get("data_json") or []
    return refresh_customer_flags(raw)


def _fetch_action_summary_row(user_id: str) -> Optional[Dict]:
    session = _user_session_insights.get(user_id)
    if session and session.get("action_summary"):
        return {
            "upload_id": _user_active_upload_id.get(user_id),
            "generated_at": session["action_summary"].get("generated_at"),
            "summary_json": session["action_summary"],
        }

    active_upload = _user_active_upload_id.get(user_id)
    rows = db_select("action_summary_cache", {"user_id": user_id}, order_by="generated_at.desc")
    if active_upload:
        for row in rows:
            if row.get("upload_id") == active_upload:
                return row
    return rows[0] if rows else None


def _fetch_insights_row(user_id: str) -> Optional[Dict]:
    session = _user_session_insights.get(user_id)
    if session and session.get("insights") is not None:
        return {
            "upload_id": _user_active_upload_id.get(user_id),
            "generated_at": (
                session.get("action_summary", {}).get("generated_at")
                if session.get("action_summary")
                else None
            ),
            "insights_json": session["insights"],
        }

    active_upload = _user_active_upload_id.get(user_id)
    rows = db_select("insights_cache", {"user_id": user_id}, order_by="generated_at.desc")
    if active_upload:
        for row in rows:
            if row.get("upload_id") == active_upload:
                return row
    return rows[0] if rows else None


def _infer_segment(c: Dict) -> str:
    """Re-apply segment logic for records that pre-date the _segment field being stamped."""
    if c.get("is_lapsed"):
        return "Lapsed"
    if c.get("is_high_value") and c.get("is_full_price_loyal"):
        return "VIPs"
    if c.get("is_at_risk"):
        return "Going Quiet"
    if c.get("is_new_customer"):
        return "New Customers"
    if c.get("is_one_time_buyer"):
        return "One-Time Buyers"
    if c.get("is_discount_dependent"):
        return "Discount Shoppers"
    return "Regulars"


def _effective_segment(c: Dict) -> str:
    """Return segment from refreshed _segment field or flag inference."""
    stored = c.get("_segment", "")
    return stored if stored else _infer_segment(c)


def _segments_from_customers(customers: List[Dict], cached_segments: Optional[List[Dict]] = None) -> List[Dict]:
    import pandas as pd

    if not customers:
        return []
    segments = compute_segments(pd.DataFrame(customers))
    total_revenue = sum(float(c.get("total_revenue", 0)) for c in customers)
    for seg in segments:
        seg["revenue_pct"] = round(
            float(seg.get("total_revenue", 0)) / max(total_revenue, 1) * 100, 1
        )
        seg["color"] = _SEGMENT_COLORS.get(seg.get("name", ""), seg.get("color", "#6B7280"))
    if cached_segments:
        return _merge_segment_enrichment(segments, cached_segments)
    return segments


def _fetch_insights(user_id: str) -> List[Dict]:
    session = _user_session_insights.get(user_id)
    if session and session.get("insights") is not None:
        return session["insights"]
    rows = db_select("insights_cache", {"user_id": user_id}, order_by="generated_at.desc")
    if not rows:
        return []
    return rows[0].get("insights_json") or []


def _csv_response(rows: List[Dict], fieldnames: List[str], filename: str) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _today_str() -> str:
    return date.today().isoformat()


_SEGMENT_COLORS: Dict[str, str] = {
    "VIPs":             "#7C3AED",
    "Regulars":         "#2563EB",
    "New Customers":    "#059669",
    "One-Time Buyers":  "#D97706",
    "Going Quiet":      "#DC2626",
    "Lapsed":           "#6B7280",
    "Discount Shoppers":"#EA580C",
}


# ── Core read endpoints ───────────────────────────────────────────────────────

@router.get("/customers")
async def get_customer_insights(_user: dict = Depends(require_auth)):
    user_id = _user.get("sub")
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Unauthorised"})

    rows = db_select("customer_insights_cache", {"user_id": user_id}, order_by="generated_at.desc")
    if not rows:
        return JSONResponse(status_code=404, content={"error": "No customer insights found. Upload data first."})

    record = rows[0]
    return {
        "success": True,
        "upload_id": record.get("upload_id"),
        "row_count": record.get("row_count", 0),
        "skipped_rows": record.get("skipped_rows", 0),
        "generated_at": record.get("generated_at"),
        "data": refresh_customer_flags(record.get("data_json", [])),
    }


@router.get("/segments")
async def get_segments(_user: dict = Depends(require_auth)):
    """
    Return the 7 lifecycle segments (VIPs, Regulars, …), always recomputed
    from fresh customer flags. Cached action_summary_cache segments are only
    used to enrich the result with benchmark/trend metadata, never as the
    source of counts — that cache can predate a flag/segment logic change
    (e.g. is_lapsed thresholds) and would otherwise show everyone stuck in
    whatever segment they were in when it was written.
    """
    user_id = _user.get("sub")
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Unauthorised"})

    customers = _fetch_customers(user_id)
    if not customers:
        return JSONResponse(status_code=404, content={"error": "No customer data found."})

    summary_row = _fetch_action_summary_row(user_id)
    cached_segments = summary_row.get("summary_json", {}).get("segments", []) if summary_row else []
    segments = _segments_from_customers(customers, cached_segments)

    return {"success": True, "segments": segments}


@router.get("/action-summary")
async def get_action_summary(_user: dict = Depends(require_auth)):
    user_id = _user.get("sub")
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Unauthorised"})

    record = _fetch_action_summary_row(user_id)
    if not record:
        return JSONResponse(status_code=404, content={"error": "No action summary found. Upload data first."})

    summary = record.get("summary_json", {})
    if not summary.get("groups") and summary.get("weekly_growth_plan"):
        summary = {
            **summary,
            "groups": growth_plan_json_to_action_groups(summary["weekly_growth_plan"]),
        }
    return {
        "success": True,
        "upload_id": record.get("upload_id"),
        "generated_at": record.get("generated_at"),
        "summary": summary,
    }


@router.get("/bank")
async def get_insight_bank(_user: dict = Depends(require_auth)):
    """Return the full scored insight bank for the current user."""
    user_id = _user.get("sub")
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Unauthorised"})

    record = _fetch_insights_row(user_id)
    if not record:
        return JSONResponse(status_code=404, content={"error": "No insights found. Upload data first."})

    return {
        "success": True,
        "upload_id": record.get("upload_id"),
        "generated_at": record.get("generated_at"),
        "insights": record.get("insights_json", []),
    }


# ── Action state endpoints ────────────────────────────────────────────────────

@router.get("/action-state")
async def get_action_state(_user: dict = Depends(require_auth)):
    """Return all action states (done/snoozed) for the current user."""
    user_id = _user.get("sub")
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Unauthorised"})

    rows = db_select("action_state", {"user_id": user_id}, order_by="updated_at.desc")
    return {"success": True, "states": rows}


@router.post("/action-state")
async def set_action_state(request: Request, _user: dict = Depends(require_auth)):
    """
    Upsert action done/snooze state.
    Body: { action_key, is_done?, snoozed?, upload_id? }
    """
    user_id = _user.get("sub")
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Unauthorised"})

    body = await request.json()
    action_key = body.get("action_key", "").strip()
    if not action_key:
        return JSONResponse(status_code=400, content={"error": "action_key is required"})

    db_upsert("action_state", {
        "user_id": user_id,
        "action_key": action_key,
        "is_done": bool(body.get("is_done", False)),
        "snoozed": bool(body.get("snoozed", False)),
        "snooze_upload_id": body.get("upload_id") if body.get("snoozed") else None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True}


# ── Download endpoints ────────────────────────────────────────────────────────

@router.get("/download/segment/{segment_name}")
async def download_segment_csv(segment_name: str, _user: dict = Depends(require_auth)):
    """CSV of all customers in a named segment."""
    user_id = _user.get("sub")
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Unauthorised"})

    customers = _fetch_customers(user_id)
    filtered = [c for c in customers if _effective_segment(c) == segment_name]

    rows = [
        {
            "email_or_id": _customer_key_col(c),
            "segment": segment_name,
            "total_spent": c.get("total_revenue", 0),
            "orders": c.get("order_count", 0),
            "last_order": _fmt_date(c.get("last_order_date")),
            "avg_order_value": round(float(c.get("aov", 0)), 2),
            "days_since_last_order": c.get("days_since_last_order", ""),
            "recommended_action": c.get("recommended_action", ""),
            "action_reason": c.get("action_reason", ""),
        }
        for c in filtered
    ]

    safe_name = re.sub(r"[^a-z0-9]+", "_", segment_name.lower())
    filename = f"strategiq-segment-{safe_name}-{_today_str()}.csv"
    fields = ["email_or_id", "segment", "total_spent", "orders", "last_order",
              "avg_order_value", "days_since_last_order", "recommended_action", "action_reason"]
    return _csv_response(rows, fields, filename)


@router.get("/download/action/{action_key}")
async def download_action_csv(action_key: str, _user: dict = Depends(require_auth)):
    """CSV of all customers for a given action group (matched by slugified action name)."""
    user_id = _user.get("sub")
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Unauthorised"})

    customers = _fetch_customers(user_id)
    summary_rows = db_select("action_summary_cache", {"user_id": user_id}, order_by="generated_at.desc")
    summary_json = summary_rows[0].get("summary_json", {}) if summary_rows else {}
    filtered = _filter_customers_by_action(customers, action_key, summary_json)

    rows = [
        {
            "email_or_id": _customer_key_col(c),
            "action": c.get("recommended_action", ""),
            "reason": c.get("action_reason", ""),
            "priority": c.get("action_priority", ""),
            "channel": c.get("suggested_channel", ""),
            "timing": c.get("suggested_timing", ""),
            "total_spent": c.get("total_revenue", 0),
            "orders": c.get("order_count", 0),
            "last_order": _fmt_date(c.get("last_order_date")),
        }
        for c in filtered
    ]

    filename = f"strategiq-action-{action_key}-{_today_str()}.csv"
    fields = ["email_or_id", "action", "reason", "priority", "channel", "timing",
              "total_spent", "orders", "last_order"]
    return _csv_response(rows, fields, filename)


@router.get("/download/insight/{insight_id}")
async def download_insight_csv(insight_id: str, _user: dict = Depends(require_auth)):
    """CSV of all customers affected by a given insight."""
    user_id = _user.get("sub")
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Unauthorised"})

    insights = _fetch_insights(user_id)
    insight = next((ins for ins in insights if ins.get("id") == insight_id), None)
    if not insight:
        return JSONResponse(status_code=404, content={"error": "Insight not found."})

    customer_keys_set = set(insight.get("customer_keys", []))
    customers = _fetch_customers(user_id)
    filtered = [c for c in customers if _customer_key_col(c) in customer_keys_set]

    rows = [
        {
            "email_or_id": _customer_key_col(c),
            "insight_category": insight.get("category", ""),
            "insight_headline": insight.get("headline", ""),
            "total_spent": c.get("total_revenue", 0),
            "orders": c.get("order_count", 0),
            "last_order": _fmt_date(c.get("last_order_date")),
            "days_since_last_order": c.get("days_since_last_order", ""),
            "segment": c.get("_segment", ""),
        }
        for c in filtered
    ]

    safe_id = re.sub(r"[^a-z0-9]+", "_", insight_id.lower())
    filename = f"strategiq-insight-{safe_id}-{_today_str()}.csv"
    fields = ["email_or_id", "insight_category", "insight_headline", "total_spent",
              "orders", "last_order", "days_since_last_order", "segment"]
    return _csv_response(rows, fields, filename)


@router.get("/download/all")
async def download_all_zip(_user: dict = Depends(require_auth)):
    """ZIP containing one CSV per section: segments, actions, insights customers."""
    user_id = _user.get("sub")
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Unauthorised"})

    customers = _fetch_customers(user_id)
    insights = _fetch_insights(user_id)
    today = _today_str()

    def _build_csv(rows: list[dict], fieldnames: list[str]) -> bytes:
        buf = io.StringIO()
        w = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
        return buf.getvalue().encode("utf-8")

    # Segments CSV — all customers with their segment
    seg_rows = [
        {
            "email_or_id": _customer_key_col(c),
            "segment": _effective_segment(c),
            "total_spent": c.get("total_revenue", 0),
            "orders": c.get("order_count", 0),
            "last_order": _fmt_date(c.get("last_order_date")),
            "avg_order_value": round(float(c.get("aov", 0)), 2),
            "recommended_action": c.get("recommended_action", ""),
        }
        for c in customers
    ]
    seg_fields = ["email_or_id", "segment", "total_spent", "orders",
                  "last_order", "avg_order_value", "recommended_action"]

    # Actions CSV — all customers with their action
    act_rows = [
        {
            "email_or_id": _customer_key_col(c),
            "action": c.get("recommended_action", ""),
            "priority": c.get("action_priority", ""),
            "channel": c.get("suggested_channel", ""),
            "timing": c.get("suggested_timing", ""),
            "reason": c.get("action_reason", ""),
            "total_spent": c.get("total_revenue", 0),
            "orders": c.get("order_count", 0),
            "last_order": _fmt_date(c.get("last_order_date")),
        }
        for c in customers
    ]
    act_fields = ["email_or_id", "action", "priority", "channel", "timing",
                  "reason", "total_spent", "orders", "last_order"]

    # Insights CSV — customers mapped to their insights
    cust_map = {_customer_key_col(c): c for c in customers}
    ins_rows = []
    for ins in insights:
        for key in ins.get("customer_keys", []):
            c = cust_map.get(key, {})
            ins_rows.append({
                "email_or_id": key,
                "insight_id": ins.get("id", ""),
                "category": ins.get("category", ""),
                "headline": ins.get("headline", ""),
                "confidence": ins.get("confidence", ""),
                "revenue_at_stake": ins.get("revenue_at_stake", 0),
                "suggested_action": ins.get("suggested_action", ""),
                "total_spent": c.get("total_revenue", 0),
                "segment": c.get("_segment", ""),
            })
    ins_fields = ["email_or_id", "insight_id", "category", "headline",
                  "confidence", "revenue_at_stake", "suggested_action", "total_spent", "segment"]

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"strategiq-segments-{today}.csv", _build_csv(seg_rows, seg_fields))
        zf.writestr(f"strategiq-actions-{today}.csv", _build_csv(act_rows, act_fields))
        zf.writestr(f"strategiq-insights-{today}.csv", _build_csv(ins_rows, ins_fields))
    zip_buf.seek(0)

    return StreamingResponse(
        iter([zip_buf.read()]),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="strategiq-export-{today}.zip"'},
    )


# ── Segment customer list (for modal) ─────────────────────────────────────────

@router.get("/segment-customers/{segment_name}")
async def get_segment_customers(segment_name: str, _user: dict = Depends(require_auth)):
    """Return the customer list for a named segment (for the segment modal)."""
    user_id = _user.get("sub")
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Unauthorised"})

    customers = _fetch_customers(user_id)
    filtered = [
        {
            "email_or_id": _customer_key_col(c),
            "total_revenue": c.get("total_revenue", 0),
            "order_count": c.get("order_count", 0),
            "last_order_date": _fmt_date(c.get("last_order_date")),
            "days_since_last_order": c.get("days_since_last_order", -1),
            "aov": round(float(c.get("aov", 0)), 2),
            "recommended_action": c.get("recommended_action", ""),
            "action_reason": c.get("action_reason", ""),
            "action_priority": c.get("action_priority", "low"),
        }
        for c in customers
        if _effective_segment(c) == segment_name
    ]
    # Sort by total_revenue descending
    filtered.sort(key=lambda x: float(x["total_revenue"]), reverse=True)

    return {"success": True, "segment": segment_name, "customers": filtered, "count": len(filtered)}


# ── Action customer list (for expanded action rows) ────────────────────────────

@router.get("/action-customers/{action_key}")
async def get_action_customers(action_key: str, _user: dict = Depends(require_auth)):
    """Return customers for an action group, matched by slugified action key."""
    user_id = _user.get("sub")
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Unauthorised"})

    customers = _fetch_customers(user_id)
    summary_rows = db_select("action_summary_cache", {"user_id": user_id}, order_by="generated_at.desc")
    summary_json = summary_rows[0].get("summary_json", {}) if summary_rows else {}
    filtered = _filter_customers_by_action(customers, action_key, summary_json)
    rows = [
        {
            "email_or_id": _customer_key_col(c),
            "total_revenue": c.get("total_revenue", 0),
            "order_count": c.get("order_count", 0),
            "last_order_date": _fmt_date(c.get("last_order_date")),
            "reason": c.get("action_reason", ""),
            "channel": c.get("suggested_channel", ""),
            "timing": c.get("suggested_timing", ""),
        }
        for c in filtered
    ]
    rows.sort(key=lambda x: float(x["total_revenue"]), reverse=True)

    return {"success": True, "action_key": action_key, "customers": rows, "count": len(rows)}

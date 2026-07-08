"""
Data Upload v2 — FastAPI router
Adds Excel support, per-user persistent storage, upload history,
column mapping persistence, row-level validation, sample data mode,
confidence scores, and a data preview step.

Mount point (set in main.py): /api/upload/v2
"""
import asyncio
import difflib
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from core_config import CORE_REQUIRED_COLUMNS
from services.data_cleaner import DataCleaner
from services.analytics import AnalyticsService
from services.customer_insights import (
    build_customer_insights,
    compute_segments,
    _assign_segment,
    _analysis_reference_date,
)
from services.insights_generator import generate_insight_bank, SEGMENT_BENCHMARKS
from services.recommendation_engine import create_recommendation_engine
from services.recommendation_serializer import (
    growth_plan_to_action_groups,
    serialize_weekly_growth_plan,
)
from services.supabase_service import (
    db_insert, db_select, db_delete, db_upsert, db_update,
    storage_upload, storage_delete, storage_download,
)
from shared.auth import require_auth
from shared.state import _user_data, _user_sample_mode
from utils.validators import COLUMN_MAPPINGS, find_matching_column

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Constants ─────────────────────────────────────────────────────────────────

MAX_FILE_BYTES = 50 * 1024 * 1024  # 50 MB
SAMPLE_CSV_PATH = Path(__file__).resolve().parent.parent / "sample_data" / "shopify_sample.csv"
_CSV_ENCODINGS = ("utf-8-sig", "utf-8", "latin-1", "cp1252")

CRITICAL_FIELDS: Dict[str, List[str]] = {
    "order_id": CORE_REQUIRED_COLUMNS.get("order_id", []) + ["name"],
    "order_date": CORE_REQUIRED_COLUMNS.get("order_date", []),
    "total_price": (
        CORE_REQUIRED_COLUMNS.get("total", [])
        + ["total price", "total_price", "subtotal", "grand total", "order total", "price"]
    ),
    "line_items": [
        "lineitem name", "lineitem quantity", "lineitem price",
        "line item", "line items", "line_items", "product_name", "item name",
        "title", "product name", "product", "item", "variant title", "lineitem_name",
    ],
    "customer_identifier": [
        "email", "customer email", "customer_email", "email address",
        "customer id", "customer_id", "customerid", "customer number",
        "user id", "user_id", "userid", "client id", "client_id",
        "buyer id", "buyer_id", "shopper id", "contact email",
        "contact id", "member id", "member_id", "account id", "account_id",
    ],
}
FIELD_LABELS = {
    "order_id": "Order ID",
    "order_date": "Order Date",
    "total_price": "Order Total / Revenue",
    "line_items": "Line Items (Products)",
    "customer_identifier": "Customer Identifier",
}
FIELD_DESCRIPTIONS = {
    "order_id": "A unique identifier for each order.",
    "order_date": "The date each order was placed.",
    "total_price": "The total amount charged for each order.",
    "line_items": "The product(s) included in each order.",
    "customer_identifier": "A unique identifier per customer — can be an email address, a numeric customer ID, or any consistent ID.",
}
FIELD_MISSING_MESSAGES = {
    "order_id": "We couldn't find an Order ID column. Without it, we can't tell your orders apart.",
    "order_date": "We couldn't find an Order Date column. Without it, we can't show trends over time.",
    "total_price": "We couldn't find a Revenue column (e.g. 'Total Price' or 'Subtotal'). This is required to calculate your total sales.",
    "line_items": "We couldn't find a product column. Product analytics won't be available — but revenue and customer insights will still work.",
    "customer_identifier": "We couldn't find a customer identifier. Without it, we can't count unique customers or build segments. Select whichever column uniquely identifies each customer.",
}
FIELD_TRANSLATE = {
    "total_price": "total",
    "line_items": "product_name",
    # Keep as customer_id so data_cleaner's email-only @ filter doesn't drop all rows.
    # analytics.py._customer_col() finds whichever of customer_email / customer_id is present.
    "customer_identifier": "customer_id",
}

# ── JSON safety (local copy to avoid circular import from main.py) ─────────────

def _json_safe(obj: Any) -> Any:
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        return 0.0 if (np.isnan(v) or np.isinf(v)) else v
    if isinstance(obj, float):
        return 0.0 if (np.isnan(obj) or np.isinf(obj)) else obj
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, (datetime, pd.Timestamp)):
        return obj.isoformat() if pd.notna(obj) else None
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_json_safe(i) for i in obj]
    try:
        if pd.isna(obj):
            return None
    except Exception:
        pass
    return obj

# ── File reading ──────────────────────────────────────────────────────────────

def _read_csv(content: bytes) -> Tuple[pd.DataFrame, str]:
    """Try common encodings. Returns (df, encoding_used)."""
    last_exc: Optional[Exception] = None
    for enc in _CSV_ENCODINGS:
        try:
            return pd.read_csv(BytesIO(content), encoding=enc), enc
        except Exception as exc:
            last_exc = exc
    raise last_exc  # type: ignore


def _read_excel(content: bytes, sheet_index: int = 0) -> Tuple[pd.DataFrame, List[str]]:
    """Read a specific sheet. Returns (df, all_sheet_names)."""
    xl = pd.ExcelFile(BytesIO(content), engine="openpyxl")
    sheet_names = xl.sheet_names
    idx = min(sheet_index, len(sheet_names) - 1)
    return xl.parse(sheet_names[idx]), sheet_names

# ── Column analysis ───────────────────────────────────────────────────────────

def _analyze_columns(df: pd.DataFrame) -> dict:
    """
    Map CSV/Excel headers → the 4 critical fields.
    Returns auto_matched, confidence_scores, fuzzy_suggestions, missing, needs_mapping.
    """
    lower_to_orig: Dict[str, str] = {c.lower().strip(): c for c in df.columns}
    auto_matched: Dict[str, str] = {}
    confidence_scores: Dict[str, str] = {}
    fuzzy_suggestions: Dict[str, List[str]] = {}
    missing: List[str] = []

    for field, variants in CRITICAL_FIELDS.items():
        matched_col: Optional[str] = None

        # Pass 1: exact variant match
        for variant in variants:
            if variant.lower() in lower_to_orig:
                matched_col = lower_to_orig[variant.lower()]
                confidence_scores[field] = "high"
                break

        if matched_col:
            auto_matched[field] = matched_col
            continue

        # Pass 2: fuzzy match
        scored: List[Tuple[str, float]] = []
        for col in df.columns:
            best = max(
                difflib.SequenceMatcher(None, v.lower(), col.lower()).ratio()
                for v in variants
            )
            if best >= 0.60:
                scored.append((col, best))

        scored.sort(key=lambda x: x[1], reverse=True)
        suggestions = [s[0] for s in scored[:3]]

        if suggestions:
            fuzzy_suggestions[field] = suggestions
            top_score = scored[0][1]
            confidence_scores[field] = "medium" if top_score >= 0.75 else "low"
        else:
            missing.append(field)

    blocking = {"order_id", "order_date", "total_price"}
    needs_mapping = (
        any(f in fuzzy_suggestions for f in blocking)
        or any(f in missing for f in blocking)
    )

    return {
        "auto_matched": auto_matched,
        "confidence_scores": confidence_scores,
        "fuzzy_suggestions": fuzzy_suggestions,
        "missing": missing,
        "needs_mapping": needs_mapping,
    }


def _preview_rows(df: pd.DataFrame, n: int = 10) -> List[Dict]:
    preview = df.head(n).copy()
    preview = preview.where(pd.notnull(preview), None)
    for col in preview.select_dtypes(include=["datetime64[ns]", "datetimetz"]).columns:
        preview[col] = preview[col].astype(str)
    return _json_safe(preview.to_dict(orient="records"))

# ── Row-level validation ──────────────────────────────────────────────────────

def _validate_rows(df_clean: pd.DataFrame) -> Tuple[List[Dict], List[Dict], int]:
    """
    Returns (row_errors, duplicate_rows, warning_count).
    Row errors block processing; duplicate rows are informational warnings.
    Row numbers are 1-based (matching spreadsheet row numbers, header = row 1).
    """
    row_errors: List[Dict] = []
    duplicate_rows: List[Dict] = []
    warning_count = 0

    BLOCKING_COLS = ["order_id", "total", "order_date"]
    WARN_COLS = ["product_name"]

    for iloc_idx, (_, row) in enumerate(df_clean.iterrows()):
        row_num = iloc_idx + 2  # header = row 1, first data row = row 2

        for col in BLOCKING_COLS:
            if col not in df_clean.columns:
                continue
            val = row.get(col)
            is_empty = (
                val is None
                or (isinstance(val, float) and np.isnan(val))
                or str(val).strip() == ""
            )
            if is_empty:
                row_errors.append({
                    "row": row_num,
                    "field": col,
                    "value": str(val) if val is not None else "",
                    "error": f"{col.replace('_', ' ').title()} is empty",
                    "severity": "error",
                })

        for col in WARN_COLS:
            if col not in df_clean.columns:
                continue
            val = row.get(col)
            if val is None or str(val).strip() in ("", "Unknown Product"):
                warning_count += 1

    if "order_id" in df_clean.columns:
        dup_mask = df_clean.duplicated(subset=["order_id"], keep="first")
        for iloc_idx, idx in enumerate(df_clean[dup_mask].index):
            row_num = df_clean.index.get_loc(idx) + 2
            order_id_val = df_clean.at[idx, "order_id"]
            duplicate_rows.append({
                "row": row_num,
                "order_id": str(order_id_val),
                "message": f"Duplicate Order ID '{order_id_val}' — this row was skipped during cleaning",
                "severity": "warning",
            })

    return row_errors, duplicate_rows, warning_count

# ── Pipeline ──────────────────────────────────────────────────────────────────

def _run_pipeline(
    content: bytes,
    filename: str,
    user_mapping: Dict[str, str],
    sheet_index: int = 0,
) -> Tuple[pd.DataFrame, str]:
    """Read → apply user mapping → auto-detect remaining → clean → return (df, encoding)."""
    encoding_used = "n/a"
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else "csv"

    if ext == "csv":
        df, encoding_used = _read_csv(content)
    elif ext in ("xlsx", "xls"):
        df, _ = _read_excel(content, sheet_index)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    # Apply user's confirmed mapping first (renames CSV col → standard name)
    rename_map: Dict[str, str] = {}
    if user_mapping:
        for std_name, csv_col in user_mapping.items():
            if csv_col in df.columns:
                rename_map[csv_col] = std_name
        if rename_map:
            df = df.rename(columns=rename_map)

    # Normalize common non-standard column names that exact-match detection would miss.
    # These run after user mapping so user overrides take priority.
    _EXTRA_RENAMES = {
        'order_quantity': 'quantity',
        'order_qty': 'quantity',
        'lineitem_quantity': 'quantity',
        'product_price': 'unit_price',
        'item_price': 'unit_price',
        'price_per_item': 'unit_price',
        'order_price': 'unit_price',
    }
    for src, dst in _EXTRA_RENAMES.items():
        if src in df.columns and dst not in df.columns and src not in rename_map:
            df = df.rename(columns={src: dst})

    # Auto-detect any remaining columns not covered by user mapping
    already_mapped_originals = set(rename_map.keys())
    column_mappings: Dict[str, str] = {}
    for standard_col, possible_names in COLUMN_MAPPINGS.items():
        if standard_col in df.columns:
            continue  # already mapped
        matched_col = find_matching_column(df, possible_names)
        if matched_col and matched_col not in already_mapped_originals:
            column_mappings[matched_col] = standard_col

    cleaner = DataCleaner()
    return cleaner.clean_dataframe(df, column_mappings), encoding_used


def _build_metrics(df_clean: pd.DataFrame, user_id: str, segments: Optional[List[Dict]] = None) -> Dict:
    """Store cleaned df in shared state and compute analytics metrics."""
    _user_data[user_id] = df_clean
    analytics = AnalyticsService(df_clean)
    metrics = analytics.compute_metrics()
    return _json_safe({
        "total_revenue": metrics.total_revenue,
        "active_customers": metrics.active_customers,
        "average_order_value": metrics.avg_order_value,
        "churn_risk": metrics.churn_risk_percentage,
        "revenue_forecast": metrics.revenue_forecast,
        # Lifecycle segments (VIPs, Regulars, …) come from the recommendation-engine
        # pipeline — never the legacy RFM segments from AnalyticsService.
        "customer_segments": segments or [],
        "columns_found": list(df_clean.columns),
    })

def _customer_col(df: pd.DataFrame) -> Optional[str]:
    """Return the customer identifier column, preferring email over id."""
    if "customer_email" in df.columns:
        return "customer_email"
    if "customer_id" in df.columns:
        return "customer_id"
    return None


def _compute_segment_trends(
    new_segments: List[Dict], prev_segments: List[Dict]
) -> List[Dict]:
    """Add delta_customers and delta_revenue to each segment vs previous upload."""
    prev_map = {s["name"]: s for s in prev_segments}
    enriched = []
    for seg in new_segments:
        prev = prev_map.get(seg["name"])
        enriched.append({
            **seg,
            "delta_customers": int(seg["customers"]) - int(prev["customers"]) if prev else 0,
            "delta_revenue": round(float(seg["total_revenue"]) - float(prev["total_revenue"]), 2) if prev else 0.0,
        })
    return enriched


def _generate_what_changed(
    new_segments: List[Dict],
    prev_segments: List[Dict],
    new_total: int,
    prev_total: int,
) -> str:
    """Produce a 2-3 sentence plain-English summary of what changed since the last upload."""
    if not prev_segments:
        return f"This is your first upload — {new_total} customers across {len(new_segments)} segments have been profiled."

    delta_total = new_total - prev_total
    direction = "up" if delta_total > 0 else "down" if delta_total < 0 else "unchanged"
    sentences = [
        f"Your total customer base is {direction} {abs(delta_total)} "
        f"{'customer' if abs(delta_total) == 1 else 'customers'} "
        f"(now {new_total})."
    ]

    prev_map = {s["name"]: s for s in prev_segments}
    changes = []
    for seg in new_segments:
        prev = prev_map.get(seg["name"])
        if prev:
            delta = int(seg["customers"]) - int(prev["customers"])
            if delta != 0:
                changes.append((seg["name"], delta, float(seg["total_revenue"]) - float(prev["total_revenue"])))

    if changes:
        changes.sort(key=lambda x: abs(x[1]), reverse=True)
        top = changes[0]
        direction2 = "grew by" if top[1] > 0 else "shrank by"
        sentences.append(
            f"Biggest shift: {top[0]} {direction2} {abs(top[1])} "
            f"customer{'s' if abs(top[1]) != 1 else ''} "
            f"({'↑' if top[1] > 0 else '↓'}£{abs(top[2]):,.0f} revenue)."
        )
        if len(changes) > 1:
            concern = next((c for c in changes if c[0] in ("Lapsed", "Going Quiet") and c[1] > 0), None)
            if concern:
                sentences.append(
                    f"Watch out: {concern[0]} grew by {concern[1]} — consider a re-engagement campaign."
                )

    return " ".join(sentences)


def _format_rec_channel(channel_value: str) -> str:
    return channel_value.replace("_", " ").title()


def _format_rec_timing(timing_value: str) -> str:
    return timing_value.replace("_", " ").title()


def _apply_recommendation_engine(
    customer_df: pd.DataFrame,
    cust_col: str,
) -> Tuple[Dict, Optional[Dict]]:
    """
    Run the Recommendation Engine v1 pipeline on aggregated customer rows.

    Returns (action_summary_stub, weekly_growth_plan_json) and mutates
    customer_df in place with engine-assigned recommended_action fields.
    """
    rows = [
        (str(row[cust_col]), row)
        for row in customer_df.to_dict(orient="records")
        if row.get(cust_col) not in (None, "")
    ]
    if not rows:
        return {"generated_at": datetime.now(timezone.utc).isoformat(), "groups": []}, None

    try:
        engine_output = create_recommendation_engine().run_from_rows(rows)
    except Exception as exc:
        logger.error("recommendation_engine: run failed: %s", exc, exc_info=True)
        return {"generated_at": datetime.now(timezone.utc).isoformat(), "groups": []}, None

    top_by_customer: Dict[str, object] = {}
    for result in engine_output.results:
        if result.recommendations:
            top_by_customer[result.customer_id] = result.recommendations[0].recommendation

    for idx, row in customer_df.iterrows():
        cid = str(row[cust_col])
        rec = top_by_customer.get(cid)
        if rec is None:
            continue
        customer_df.at[idx, "recommended_action"] = rec.title
        customer_df.at[idx, "action_priority"] = rec.priority.value
        customer_df.at[idx, "suggested_channel"] = _format_rec_channel(rec.channel.value)
        customer_df.at[idx, "suggested_timing"] = _format_rec_timing(rec.timing.value)

    plan = engine_output.weekly_growth_plan
    summary_stub = {
        "generated_at": plan.generated_at,
        "groups": growth_plan_to_action_groups(plan),
    }
    return summary_stub, serialize_weekly_growth_plan(plan)


def _run_insights_pipeline(df_clean: pd.DataFrame, user_id: str, upload_id: str) -> Dict[str, Any]:
    """
    Aggregate df_clean into per-customer insights, run the Recommendation Engine,
    and persist results to Supabase.

    Returns dict with skipped count and enriched lifecycle segments for metrics.
    Runs in a thread-pool executor — do not call directly from async context.
    """
    empty: Dict[str, Any] = {"skipped": 0, "segments": []}
    cust_col = _customer_col(df_clean)
    if cust_col is None:
        logger.info("insights: no customer column found, skipping pipeline")
        return empty

    try:
        customer_df, skipped = build_customer_insights(df_clean, cust_col)
    except Exception as exc:
        logger.error("insights: build_customer_insights failed: %s", exc, exc_info=True)
        return empty

    if customer_df.empty:
        return {**empty, "skipped": skipped}

    # Read previous segments before overwriting (for trend computation)
    prev_segments: List[Dict] = []
    prev_total: int = 0
    prev_rows = db_select("action_summary_cache", {"user_id": user_id}, order_by="generated_at.desc")
    if prev_rows:
        prev_json = prev_rows[0].get("summary_json", {})
        prev_segments = prev_json.get("segments", [])
        prev_total = int(prev_json.get("total_customers", 0))

    # Lifecycle segment stamp (VIPs, Regulars, Going Quiet, …)
    customer_df["_segment"] = customer_df.apply(_assign_segment, axis=1)

    # Recommendation Engine v1 — actions, weekly growth plan, per-customer recommendations
    summary, weekly_growth_plan = _apply_recommendation_engine(customer_df, cust_col)

    # Convert to JSON-safe records (handles Timestamps, numpy types, NaN)
    records = _json_safe(customer_df.to_dict(orient="records"))

    segments = compute_segments(customer_df)
    total_customers = len(customer_df)
    total_revenue = float(customer_df["total_revenue"].sum()) if "total_revenue" in customer_df.columns else 0.0

    # Segment enrichment: revenue %, trends, benchmarks
    segments_with_trends = _compute_segment_trends(segments, prev_segments)
    for seg in segments_with_trends:
        seg["revenue_pct"] = round(seg["total_revenue"] / max(total_revenue, 1) * 100, 1)
        bm = SEGMENT_BENCHMARKS.get(seg["name"], {})
        seg["benchmark_note"] = bm.get("benchmark_note", "")
        seg["description"] = bm.get("description", "")
        seg["why"] = bm.get("why", "")
        seg["how_to_treat"] = bm.get("how_to_treat", "")
        seg["typical_pct"] = bm.get("typical_pct", "")

    # Revenue at risk (lapsed + at-risk customers) and opportunity (new + window)
    risk_mask = (
        customer_df.get("is_lapsed", pd.Series(False, index=customer_df.index)) |
        customer_df.get("is_at_risk", pd.Series(False, index=customer_df.index))
    )
    opp_mask = (
        customer_df.get("is_new_customer", pd.Series(False, index=customer_df.index)) |
        (
            customer_df.get("is_one_time_buyer", pd.Series(False, index=customer_df.index)) &
            (customer_df.get("days_since_last_order", pd.Series(-1, index=customer_df.index)) >= 30) &
            (customer_df.get("days_since_last_order", pd.Series(-1, index=customer_df.index)) <= 60)
        )
    )
    revenue_at_risk = round(float(customer_df[risk_mask]["total_revenue"].sum())
                            if "total_revenue" in customer_df.columns else 0.0, 2)
    revenue_opportunity = round(float(customer_df[opp_mask]["total_revenue"].sum())
                                if "total_revenue" in customer_df.columns else 0.0, 2)

    what_changed = _generate_what_changed(segments, prev_segments, total_customers, prev_total)

    ref_date = _analysis_reference_date(df_clean, cust_col is not None and "order_date" in df_clean.columns)

    # Generate full insight bank
    try:
        insights = generate_insight_bank(customer_df, cust_col, total_revenue)
    except Exception as exc:
        logger.error("insights: generate_insight_bank failed: %s", exc, exc_info=True)
        insights = []

    now_iso = datetime.now(timezone.utc).isoformat()

    # Upsert customer records — UNIQUE (user_id) replaces old row
    db_upsert("customer_insights_cache", {
        "user_id": user_id,
        "upload_id": upload_id,
        "data_json": records,
        "skipped_rows": skipped,
        "row_count": total_customers,
        "generated_at": now_iso,
    })

    summary_json: Dict[str, Any] = {
        **summary,
        "segments": segments_with_trends,
        "total_customers": total_customers,
        "total_revenue": total_revenue,
        "revenue_at_risk": revenue_at_risk,
        "revenue_opportunity": revenue_opportunity,
        "what_changed": what_changed,
        "analysis_reference_date": ref_date.isoformat(),
    }
    if weekly_growth_plan is not None:
        summary_json["weekly_growth_plan"] = weekly_growth_plan

    db_upsert("action_summary_cache", {
        "user_id": user_id,
        "upload_id": upload_id,
        "summary_json": summary_json,
        "generated_at": now_iso,
    })

    db_upsert("insights_cache", {
        "user_id": user_id,
        "upload_id": upload_id,
        "insights_json": _json_safe(insights),
        "generated_at": now_iso,
    })

    logger.info(
        "insights: stored %d customer rows (%d skipped), %d insights, %d segments, for user %s",
        total_customers, skipped, len(insights), len(segments_with_trends), user_id,
    )
    return {"skipped": skipped, "segments": segments_with_trends}


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/analyze-headers")
async def v2_analyze_headers(
    file: UploadFile = File(...),
    sheet_index: int = Form(0),
    _user: dict = Depends(require_auth),
):
    """
    Read file headers, detect column mapping with confidence scores.
    Supports CSV (UTF-8 → Latin-1 fallback), XLSX, XLS.
    Returns preview rows, sheet names, and any previously saved mapping.
    """
    content = await file.read()
    filename = file.filename or ""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

    if len(content) > MAX_FILE_BYTES:
        return JSONResponse(status_code=400, content={
            "success": False,
            "error": (
                "That file is over 50 MB. For larger uploads, please contact us at "
                "support@strategiq.co and we'll help you import it."
            ),
        })

    if ext not in ("csv", "xlsx", "xls"):
        return JSONResponse(status_code=400, content={
            "success": False,
            "error": (
                "We only accept CSV, XLSX, and XLS files. "
                "In Shopify, go to Orders → Export → Plain CSV for Excel."
            ),
        })

    try:
        loop = asyncio.get_event_loop()
        sheet_names: Optional[List[str]] = None
        encoding_used: Optional[str] = None

        if ext == "csv":
            df, encoding_used = await loop.run_in_executor(None, lambda: _read_csv(content))
        else:
            df, sheet_names = await loop.run_in_executor(None, lambda: _read_excel(content, sheet_index))

        if df.empty or len(df.columns) == 0:
            return JSONResponse(status_code=400, content={"success": False, "error": "The file appears to be empty."})

        analysis = _analyze_columns(df)

        # Count data rows
        if ext == "csv":
            try:
                row_count = max(0, content.decode("utf-8-sig", errors="replace").count("\n") - 1)
            except Exception:
                row_count = len(df)
        else:
            row_count = len(df)

        # Fetch user's saved mapping
        user_id = _user.get("sub", "")
        saved_rows = db_select("user_column_mappings", {"user_id": user_id})
        saved_mapping = saved_rows[0].get("mapping", {}) if saved_rows else {}

        return {
            "success": True,
            "all_columns": list(df.columns),
            "row_count": row_count,
            "auto_matched": analysis["auto_matched"],
            "confidence_scores": analysis["confidence_scores"],
            "fuzzy_suggestions": analysis["fuzzy_suggestions"],
            "missing": analysis["missing"],
            "needs_mapping": analysis["needs_mapping"],
            "preview_rows": _preview_rows(df),
            "file_type": ext,
            "sheet_names": sheet_names,
            "encoding_used": encoding_used,
            "saved_mapping": saved_mapping,
            "field_labels": FIELD_LABELS,
            "field_descriptions": FIELD_DESCRIPTIONS,
            "field_missing_messages": FIELD_MISSING_MESSAGES,
        }

    except Exception as exc:
        logger.error(f"v2/analyze-headers: {exc}", exc_info=True)
        return JSONResponse(status_code=500, content={
            "success": False,
            "error": "We couldn't read that file. Please make sure it's a valid Shopify export.",
        })


@router.post("/process")
async def v2_process(
    file: UploadFile = File(...),
    column_mapping: Optional[str] = Form(None),
    sheet_index: int = Form(0),
    _user: dict = Depends(require_auth),
):
    """
    Process a CSV/Excel file through the full analytics pipeline.
    Stores the file in Supabase Storage, creates an upload history record,
    and returns analytics metrics plus row-level validation results.
    """
    content = await file.read()
    filename = file.filename or "upload.csv"
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else "csv"

    if len(content) > MAX_FILE_BYTES:
        return JSONResponse(status_code=400, content={
            "success": False,
            "error": (
                "That file is over 50 MB. Please contact us at support@strategiq.co "
                "for help with larger imports."
            ),
        })

    if ext not in ("csv", "xlsx", "xls"):
        return JSONResponse(status_code=400, content={
            "success": False,
            "error": "Unsupported file type. Please upload a CSV, XLSX or XLS file.",
        })

    # Parse confirmed column mapping from wizard
    user_mapping: Dict[str, str] = {}
    if column_mapping:
        try:
            raw = json.loads(column_mapping)
            # Translate analyze-headers field names to pipeline standard names
            user_mapping = {FIELD_TRANSLATE.get(k, k): v for k, v in raw.items()}
        except (json.JSONDecodeError, ValueError):
            logger.warning("v2/process: invalid column_mapping JSON — ignoring.")

    user_id = _user.get("sub", "anonymous")
    upload_id = str(uuid.uuid4())
    uploaded_at = datetime.now(timezone.utc).isoformat()

    # Create history record (status: processing)
    db_insert("upload_history", {
        "id": upload_id,
        "user_id": user_id,
        "file_name": filename,
        "file_size_bytes": len(content),
        "row_count": None,
        "status": "processing",
        "storage_path": None,
        "is_sample_data": False,
        "created_at": uploaded_at,
    })

    try:
        loop = asyncio.get_event_loop()
        df_clean, encoding_used = await loop.run_in_executor(
            None, lambda: _run_pipeline(content, filename, user_mapping, sheet_index)
        )

        if df_clean.empty:
            db_update("upload_history", {"id": upload_id}, {
                "status": "failed",
                "error_message": "No valid rows after cleaning",
            })
            return JSONResponse(status_code=400, content={
                "success": False,
                "error": (
                    "No valid data was found after cleaning your file. "
                    "Check that the required columns contain data."
                ),
            })

        # Row-level validation (runs on cleaned df)
        row_errors, duplicate_rows, warning_count = await loop.run_in_executor(
            None, lambda: _validate_rows(df_clean)
        )

        # Upload raw file to Supabase Storage under user's folder
        content_type = (
            "text/csv" if ext == "csv"
            else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        storage_path = f"{user_id}/{upload_id}/{filename}"
        storage_upload(storage_path, content, content_type)

        # Run insights + recommendation engine, then compute session metrics
        pipeline_out = await loop.run_in_executor(
            None, lambda: _run_insights_pipeline(df_clean, user_id, upload_id)
        )
        skipped_customers = pipeline_out.get("skipped", 0)
        metrics = _build_metrics(df_clean, user_id, pipeline_out.get("segments"))
        _user_sample_mode[user_id] = False

        # Update history: complete
        db_update("upload_history", {"id": upload_id}, {
            "status": "complete",
            "row_count": len(df_clean),
            "storage_path": storage_path,
        })

        return _json_safe({
            "success": True,
            "upload_id": upload_id,
            "metrics": metrics,
            "rows_processed": len(df_clean),
            "row_errors": row_errors,
            "duplicate_rows": duplicate_rows,
            "warning_count": warning_count,
            "encoding_used": encoding_used,
            "uploaded_at": uploaded_at,
            "is_sample_data": False,
            "skipped_customers": skipped_customers,
        })

    except Exception as exc:
        logger.error(f"v2/process: {exc}", exc_info=True)
        db_update("upload_history", {"id": upload_id}, {
            "status": "failed",
            "error_message": str(exc)[:500],
        })
        return JSONResponse(status_code=500, content={
            "success": False,
            "error": f"Something went wrong while processing your file: {str(exc)[:200]}",
        })


@router.post("/sample-data")
async def v2_load_sample(_user: dict = Depends(require_auth)):
    """Load the bundled sample data (48-record Shopify clothing brand CSV) into the session."""
    user_id = _user.get("sub", "anonymous")

    if not SAMPLE_CSV_PATH.exists():
        return JSONResponse(status_code=500, content={
            "success": False,
            "error": "Sample data is not available on this server.",
        })

    try:
        content = SAMPLE_CSV_PATH.read_bytes()
        loop = asyncio.get_event_loop()
        df_clean, _ = await loop.run_in_executor(
            None, lambda: _run_pipeline(content, "shopify_sample.csv", {}, 0)
        )

        sample_upload_id = f"sample-{user_id}"
        pipeline_out = await loop.run_in_executor(
            None, lambda: _run_insights_pipeline(df_clean, user_id, sample_upload_id)
        )
        metrics = _build_metrics(df_clean, user_id, pipeline_out.get("segments"))
        _user_sample_mode[user_id] = True
        uploaded_at = datetime.now(timezone.utc).isoformat()

        return _json_safe({
            "success": True,
            "metrics": metrics,
            "rows_processed": len(df_clean),
            "is_sample_data": True,
            "uploaded_at": uploaded_at,
        })

    except Exception as exc:
        logger.error(f"v2/sample-data POST: {exc}", exc_info=True)
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)[:200]})


@router.delete("/sample-data")
async def v2_clear_sample(_user: dict = Depends(require_auth)):
    """Clear the user's session data (removes sample data mode)."""
    user_id = _user.get("sub", "anonymous")
    _user_data.pop(user_id, None)
    _user_sample_mode.pop(user_id, None)
    return {"success": True}


@router.get("/sample-data/status")
async def v2_sample_status(_user: dict = Depends(require_auth)):
    """Check whether the current session contains sample data or real data."""
    user_id = _user.get("sub", "anonymous")
    return {
        "is_sample_data": _user_sample_mode.get(user_id, False),
        "has_data": user_id in _user_data,
    }


@router.get("/saved-mapping")
async def v2_get_saved_mapping(_user: dict = Depends(require_auth)):
    """Return the user's previously confirmed column mapping."""
    user_id = _user.get("sub", "anonymous")
    rows = db_select("user_column_mappings", {"user_id": user_id})
    return {"mapping": rows[0].get("mapping", {}) if rows else {}}


@router.post("/saved-mapping")
async def v2_save_mapping(request: Request, _user: dict = Depends(require_auth)):
    """Persist the user's confirmed column mapping so repeat uploads skip remapping."""
    user_id = _user.get("sub", "anonymous")
    body = await request.json()
    mapping = body.get("mapping", {})
    db_upsert("user_column_mappings", {
        "user_id": user_id,
        "mapping": mapping,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True}


@router.get("/history")
async def v2_get_history(_user: dict = Depends(require_auth)):
    """Return this user's upload history, newest first."""
    user_id = _user.get("sub", "anonymous")
    rows = db_select("upload_history", {"user_id": user_id}, order_by="created_at.desc")
    return {"data": rows}


@router.delete("/history/{upload_id}")
async def v2_delete_history(upload_id: str, _user: dict = Depends(require_auth)):
    """Delete a history entry and remove the associated file from Storage."""
    user_id = _user.get("sub", "anonymous")

    rows = db_select("upload_history", {"id": upload_id, "user_id": user_id})
    if not rows:
        raise HTTPException(status_code=404, detail="Upload not found.")

    entry = rows[0]
    if entry.get("storage_path"):
        storage_delete([entry["storage_path"]])

    db_delete("upload_history", {"id": upload_id, "user_id": user_id})
    return {"success": True}


@router.post("/history/{upload_id}/set-active")
async def v2_set_active(upload_id: str, _user: dict = Depends(require_auth)):
    """Re-load a previously uploaded file from Storage into the active session."""
    user_id = _user.get("sub", "anonymous")

    rows = db_select("upload_history", {"id": upload_id, "user_id": user_id})
    if not rows:
        raise HTTPException(status_code=404, detail="Upload not found.")

    entry = rows[0]
    storage_path = entry.get("storage_path")
    if not storage_path:
        raise HTTPException(status_code=400, detail="No stored file available for this entry.")

    filename = entry.get("file_name", "file.csv")
    content = storage_download(storage_path)
    if content is None:
        raise HTTPException(status_code=500, detail="Could not retrieve the stored file.")

    try:
        loop = asyncio.get_event_loop()
        df_clean, _ = await loop.run_in_executor(
            None, lambda: _run_pipeline(content, filename, {}, 0)
        )

        pipeline_out = await loop.run_in_executor(
            None, lambda: _run_insights_pipeline(df_clean, user_id, upload_id)
        )
        metrics = _build_metrics(df_clean, user_id, pipeline_out.get("segments"))
        _user_sample_mode[user_id] = False

        return _json_safe({
            "success": True,
            "upload_id": upload_id,
            "metrics": metrics,
            "rows_processed": len(df_clean),
            "is_sample_data": False,
            "uploaded_at": entry.get("created_at"),
        })

    except Exception as exc:
        logger.error(f"v2/history/{upload_id}/set-active: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc)[:200])

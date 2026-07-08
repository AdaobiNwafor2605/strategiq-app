"""
Durable per-user cache for the cleaned order-level DataFrame.

`_user_data` (in shared/state.py) is a fast in-memory dict, but it is wiped
on every backend restart. That silently broke the Advanced Analytics
endpoints (top products, revenue trends, AOV trends, etc.) after any
restart, since they read `_user_data` directly with no fallback. This module
backs it with Supabase (`raw_data_cache` table) the same way the
recommendation-engine pipeline's customer/segment/insight caches already
survive restarts.
"""
from __future__ import annotations

import logging
from typing import List, Optional

import numpy as np
import pandas as pd

from services.supabase_service import db_select, db_upsert
from shared.state import _user_data

logger = logging.getLogger(__name__)


def _json_safe_value(value):
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        f = float(value)
        return None if (np.isnan(f) or np.isinf(f)) else f
    if isinstance(value, float):
        return None if (np.isnan(value) or np.isinf(value)) else value
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat() if pd.notna(value) else None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return value


def _to_json_records(df: pd.DataFrame) -> List[dict]:
    return [
        {k: _json_safe_value(v) for k, v in row.items()}
        for row in df.to_dict(orient="records")
    ]


def save_raw_dataframe(user_id: str, upload_id: str, df: pd.DataFrame) -> None:
    """Store the cleaned order-level DataFrame in memory and in Supabase."""
    _user_data[user_id] = df
    try:
        db_upsert("raw_data_cache", {
            "user_id": user_id,
            "upload_id": upload_id,
            "data_json": _to_json_records(df),
            "row_count": len(df),
        })
    except Exception:
        logger.error("raw_data_cache: failed to persist for user %s", user_id, exc_info=True)


def load_raw_dataframe(user_id: str) -> Optional[pd.DataFrame]:
    """
    Return the user's cleaned order-level DataFrame.

    Checks the in-memory cache first (fast path, same process that served the
    upload). Falls back to Supabase on a cold process (e.g. after a restart)
    and re-warms the in-memory cache so subsequent requests skip the round-trip.
    """
    df = _user_data.get(user_id)
    if df is not None:
        return df

    rows = db_select("raw_data_cache", {"user_id": user_id}, order_by="generated_at.desc")
    if not rows:
        return None
    records = rows[0].get("data_json") or []
    if not records:
        return None

    df = pd.DataFrame(records)
    _user_data[user_id] = df
    return df

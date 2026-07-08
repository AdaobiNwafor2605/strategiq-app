"""
Shared in-memory state for per-user data.
Imported by both main.py and the v2 upload router so they share the same store.
"""
from typing import Any, Dict

# Keyed by JWT sub (user ID). Stores the cleaned DataFrame for each user.
_user_data: Dict[str, Any] = {}

# Tracks whether the user is currently viewing sample data.
_user_sample_mode: Dict[str, bool] = {}

# Active upload for this server session (sample-{user_id} or a real upload UUID).
_user_active_upload_id: Dict[str, str] = {}

# Latest pipeline output per user — used when Supabase cache is stale or unavailable.
_user_session_insights: Dict[str, Dict[str, Any]] = {}

"""
Shared in-memory state for per-user data.
Imported by both main.py and the v2 upload router so they share the same store.
"""
from typing import Any, Dict

# Keyed by JWT sub (user ID). Stores the cleaned DataFrame for each user.
_user_data: Dict[str, Any] = {}

# Tracks whether the user is currently viewing sample data.
_user_sample_mode: Dict[str, bool] = {}

# Tracks the upload_id currently active for each user (real or sample upload).
_user_active_upload_id: Dict[str, str] = {}

# Populated after each successful insights-pipeline run with the exact dict
# returned by _run_insights_pipeline (customers/segments/action_summary/insights).
# In-memory only — resets on backend restart, at which point reads fall back
# to Supabase and get refreshed via refresh_customer_flags().
_user_session_insights: Dict[str, Dict[str, Any]] = {}

"""
Supabase HTTP helpers for upload history and column mapping persistence.
Uses urllib (already in stdlib) so no new dependencies needed.
"""
import os
import json
import urllib.request
import urllib.error
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

BUCKET = "strategiq-uploads"


def _supabase_url() -> str:
    return os.environ.get("SUPABASE_URL", "").rstrip("/")


def _key() -> str:
    return os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def _configured() -> bool:
    """Return True when Supabase REST calls can be made."""
    return bool(_supabase_url() and _key())


def _rest_headers(extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    h = {
        "Authorization": f"Bearer {_key()}",
        "apikey": _key(),
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


def _storage_headers(content_type: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {_key()}",
        "apikey": _key(),
        "Content-Type": content_type,
    }


# ── REST helpers ──────────────────────────────────────────────────────────────

def db_insert(table: str, data: Dict) -> Optional[Dict]:
    if not _configured():
        logger.warning("db_insert %s skipped — SUPABASE_URL or service role key not set", table)
        return None
    url = f"{_supabase_url()}/rest/v1/{table}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    for k, v in _rest_headers({"Prefer": "return=representation"}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            return result[0] if isinstance(result, list) and result else result
    except Exception as exc:
        logger.error(f"db_insert {table}: {exc}")
        return None


def db_upsert(table: str, data: Dict) -> Optional[Dict]:
    if not _configured():
        logger.warning("db_upsert %s skipped — SUPABASE_URL or service role key not set", table)
        return None
    url = f"{_supabase_url()}/rest/v1/{table}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    for k, v in _rest_headers({"Prefer": "resolution=merge-duplicates,return=representation"}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            return result[0] if isinstance(result, list) and result else result
    except Exception as exc:
        logger.error(f"db_upsert {table}: {exc}")
        return None


def db_select(table: str, filters: Dict[str, str], order_by: str = "created_at.desc") -> List[Dict]:
    if not _configured():
        logger.warning("db_select %s skipped — SUPABASE_URL or service role key not set", table)
        return []
    params = "&".join(f"{k}=eq.{v}" for k, v in filters.items())
    url = f"{_supabase_url()}/rest/v1/{table}?{params}&order={order_by}"
    try:
        req = urllib.request.Request(url, method="GET")
        for k, v in _rest_headers().items():
            req.add_header(k, v)
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except Exception as exc:
        logger.error(f"db_select {table}: {exc}")
        return []


def db_update(table: str, filters: Dict[str, str], data: Dict) -> bool:
    if not _configured():
        logger.warning("db_update %s skipped — SUPABASE_URL or service role key not set", table)
        return False
    params = "&".join(f"{k}=eq.{v}" for k, v in filters.items())
    url = f"{_supabase_url()}/rest/v1/{table}?{params}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, method="PATCH")
    for k, v in _rest_headers({"Prefer": "return=minimal"}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status in (200, 204)
    except Exception as exc:
        logger.error(f"db_update {table}: {exc}")
        return False


def db_delete(table: str, filters: Dict[str, str]) -> bool:
    if not _configured():
        logger.warning("db_delete %s skipped — SUPABASE_URL or service role key not set", table)
        return False
    params = "&".join(f"{k}=eq.{v}" for k, v in filters.items())
    url = f"{_supabase_url()}/rest/v1/{table}?{params}"
    req = urllib.request.Request(url, method="DELETE")
    for k, v in _rest_headers({"Prefer": "return=minimal"}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status in (200, 204)
    except Exception as exc:
        logger.error(f"db_delete {table}: {exc}")
        return False


# ── Storage helpers ───────────────────────────────────────────────────────────

def storage_upload(path: str, content: bytes, content_type: str) -> bool:
    """Upload a file to the strategiq-uploads bucket at the given path."""
    if not _configured():
        logger.warning("storage_upload skipped — SUPABASE_URL or service role key not set")
        return False
    url = f"{_supabase_url()}/storage/v1/object/{BUCKET}/{path}"
    req = urllib.request.Request(url, data=content, method="POST")
    for k, v in _storage_headers(content_type).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status in (200, 201)
    except urllib.error.HTTPError as exc:
        if exc.code == 409:
            # File already exists — overwrite with PUT
            req2 = urllib.request.Request(url, data=content, method="PUT")
            for k, v in _storage_headers(content_type).items():
                req2.add_header(k, v)
            try:
                with urllib.request.urlopen(req2) as resp2:
                    return resp2.status in (200, 201)
            except Exception:
                return False
        logger.error(f"storage_upload {path}: HTTP {exc.code}")
        return False
    except Exception as exc:
        logger.error(f"storage_upload {path}: {exc}")
        return False


def storage_delete(paths: List[str]) -> bool:
    """Delete files from the strategiq-uploads bucket."""
    if not _configured():
        logger.warning("storage_delete skipped — SUPABASE_URL or service role key not set")
        return False
    url = f"{_supabase_url()}/storage/v1/object/{BUCKET}"
    body = json.dumps({"prefixes": paths}).encode()
    req = urllib.request.Request(url, data=body, method="DELETE")
    for k, v in _storage_headers("application/json").items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status in (200, 204)
    except Exception as exc:
        logger.error(f"storage_delete {paths}: {exc}")
        return False


def storage_download(path: str) -> Optional[bytes]:
    """Download a file from the strategiq-uploads bucket."""
    if not _configured():
        logger.warning("storage_download skipped — SUPABASE_URL or service role key not set")
        return None
    url = f"{_supabase_url()}/storage/v1/object/{BUCKET}/{path}"
    req = urllib.request.Request(url, method="GET")
    req.add_header("Authorization", f"Bearer {_key()}")
    req.add_header("apikey", _key())
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.read()
    except Exception as exc:
        logger.error(f"storage_download {path}: {exc}")
        return None

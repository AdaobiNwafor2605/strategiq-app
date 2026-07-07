"""
Shared JWT auth dependency used by main.py and v2 router.
Extracted here to avoid circular imports between main.py and route files.
"""
import json
import logging
import os
import urllib.request

from fastapi import Header, HTTPException
from jose import JWTError, jwk, jwt

logger = logging.getLogger(__name__)

_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")
_SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
_jwks_key = None


def _load_jwks_key():
    """Fetch the ES256/RS256 public key from Supabase's JWKS endpoint."""
    global _jwks_key
    if not _SUPABASE_URL:
        return
    url = f"{_SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read())
        keys = data.get("keys", [])
        if keys:
            _jwks_key = jwk.construct(keys[0])
            logger.info(f"Loaded JWKS public key (alg={keys[0].get('alg')})")
    except Exception as exc:
        logger.warning(f"Could not load JWKS key: {exc}")


def require_auth(authorization: str = Header(...)) -> dict:
    """
    FastAPI dependency — verifies the Supabase JWT.

    Supabase projects created after ~2024 use ES256 (new JWT Signing Keys).
    Older projects used HS256 with a legacy secret. We handle both:
      - Peek at the token header to see which alg is in use
      - ES256 / RS256 → verify with the JWKS public key
      - HS256         → verify with SUPABASE_JWT_SECRET
    If neither is configured, skip auth (safe for local dev only).
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")

    token = authorization[len("Bearer "):].strip()

    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")

        if alg in ("ES256", "RS256"):
            if _jwks_key is None:
                _load_jwks_key()
            if _jwks_key is None:
                logger.warning("JWKS key unavailable — skipping auth check.")
                return {}
            payload = jwt.decode(token, _jwks_key, algorithms=[alg], audience="authenticated")
        else:
            if not _JWT_SECRET:
                logger.warning("SUPABASE_JWT_SECRET not set — skipping auth check.")
                return {}
            payload = jwt.decode(token, _JWT_SECRET, algorithms=["HS256"], audience="authenticated")

        return payload

    except JWTError as exc:
        logger.warning(f"JWT validation failed: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=401,
            detail="Your session has expired. Please log in again.",
        )

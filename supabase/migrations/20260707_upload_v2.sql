-- StrategIQ: Data Upload v2 migrations
-- Run this in Supabase SQL Editor (Database → SQL Editor → New query)
-- 2026-07-07

-- ── upload_history ────────────────────────────────────────────────────────────
-- Tracks every file upload per user. The backend writes to this table using
-- the service role key (bypasses RLS). Users read their own rows via RLS.

CREATE TABLE IF NOT EXISTS upload_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  row_count       INTEGER,
  status          TEXT NOT NULL DEFAULT 'processing',  -- 'processing' | 'complete' | 'failed'
  storage_path    TEXT,                                -- path in strategiq-uploads bucket
  error_message   TEXT,
  is_sample_data  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE upload_history ENABLE ROW LEVEL SECURITY;

-- Users can only read their own upload history
CREATE POLICY "Users see their own upload history"
  ON upload_history FOR SELECT
  USING (auth.uid() = user_id);

-- Backend (service role) handles INSERT/UPDATE/DELETE — no direct client writes needed
-- If you ever want to allow client-side deletes, add a DELETE policy here.


-- ── user_column_mappings ──────────────────────────────────────────────────────
-- Saves the user's confirmed column mapping so repeat uploads skip remapping.
-- One row per user (upserted on each save).

CREATE TABLE IF NOT EXISTS user_column_mappings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  mapping    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_column_mappings ENABLE ROW LEVEL SECURITY;

-- Users can only read their own saved mapping
CREATE POLICY "Users see their own column mapping"
  ON user_column_mappings FOR SELECT
  USING (auth.uid() = user_id);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_upload_history_user_id
  ON upload_history(user_id, created_at DESC);

-- ── Action State ──────────────────────────────────────────────────────────────
-- Persists mark-as-done and snooze state per user per action group.
-- action_key is a URL-safe slug of the action name.

CREATE TABLE IF NOT EXISTS action_state (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_key  TEXT NOT NULL,
    is_done     BOOLEAN NOT NULL DEFAULT FALSE,
    snoozed     BOOLEAN NOT NULL DEFAULT FALSE,
    snooze_upload_id TEXT,   -- cleared when next upload has a different ID
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT action_state_user_action_unique UNIQUE (user_id, action_key)
);

ALTER TABLE action_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own action state"
    ON action_state FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access to action state"
    ON action_state FOR ALL
    USING (auth.role() = 'service_role');


-- ── Insights Cache ─────────────────────────────────────────────────────────────
-- Full scored insight bank per user — one row, replaced on every upload.

CREATE TABLE IF NOT EXISTS insights_cache (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    upload_id     TEXT,
    insights_json JSONB NOT NULL DEFAULT '[]',
    generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT insights_cache_user_unique UNIQUE (user_id)
);

ALTER TABLE insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own insights"
    ON insights_cache FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users insert own insights"
    ON insights_cache FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own insights"
    ON insights_cache FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to insights"
    ON insights_cache FOR ALL
    USING (auth.role() = 'service_role');

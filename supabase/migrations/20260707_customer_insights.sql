-- ── Customer Insights Cache ────────────────────────────────────────────────────
-- One JSON blob per user — replaced on every upload.
-- Storing as JSONB avoids 1000+ individual row upserts and makes the
-- insights endpoint a single-row fetch instead of a table scan.

CREATE TABLE IF NOT EXISTS customer_insights_cache (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    upload_id   TEXT,
    data_json   JSONB NOT NULL DEFAULT '[]',
    skipped_rows INTEGER NOT NULL DEFAULT 0,
    row_count   INTEGER NOT NULL DEFAULT 0,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT customer_insights_cache_user_unique UNIQUE (user_id)
);

ALTER TABLE customer_insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own customer insights"
    ON customer_insights_cache FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own customer insights"
    ON customer_insights_cache FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own customer insights"
    ON customer_insights_cache FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role bypass (backend writes insights on behalf of users)
CREATE POLICY "Service role full access to customer insights"
    ON customer_insights_cache FOR ALL
    USING (auth.role() = 'service_role');


-- ── Action Summary Cache ───────────────────────────────────────────────────────
-- One JSON blob per user — grouped weekly action summary.

CREATE TABLE IF NOT EXISTS action_summary_cache (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    upload_id    TEXT,
    summary_json JSONB NOT NULL DEFAULT '{}',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT action_summary_cache_user_unique UNIQUE (user_id)
);

ALTER TABLE action_summary_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own action summary"
    ON action_summary_cache FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own action summary"
    ON action_summary_cache FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own action summary"
    ON action_summary_cache FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to action summary"
    ON action_summary_cache FOR ALL
    USING (auth.role() = 'service_role');

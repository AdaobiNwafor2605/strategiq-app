-- ── Raw Data Cache ─────────────────────────────────────────────────────────────
-- Durable backing for the cleaned order-level DataFrame used by the Advanced
-- Analytics endpoints (top products, revenue trends, AOV trends, customer
-- analysis, geographic analysis, order volume trends, revenue per customer).
--
-- Previously this only lived in the in-memory `_user_data` dict in
-- backend/shared/state.py, which is wiped on every backend restart — after a
-- restart, all of those endpoints would return "No data available" until the
-- user uploaded again. This table lets them survive a restart the same way
-- customer_insights_cache / action_summary_cache / insights_cache already do.

CREATE TABLE IF NOT EXISTS raw_data_cache (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    upload_id    TEXT,
    data_json    JSONB NOT NULL DEFAULT '[]',
    row_count    INTEGER NOT NULL DEFAULT 0,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT raw_data_cache_user_unique UNIQUE (user_id)
);

ALTER TABLE raw_data_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own raw data"
    ON raw_data_cache FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users insert own raw data"
    ON raw_data_cache FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own raw data"
    ON raw_data_cache FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to raw data"
    ON raw_data_cache FOR ALL
    USING (auth.role() = 'service_role');

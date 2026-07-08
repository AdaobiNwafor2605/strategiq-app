# StrategIQ Decision Log

A dated record of what was done on this project and why. Add a new entry
every time a decision is made or meaningful work is completed — newest
entries go at the bottom.

---

## 2025-06-20 — Initial MVP built

**What:** First working version of the app committed: FastAPI backend
(data cleaning, analytics, ML routes), React/Vite frontend with a
dashboard, upload flow, and basic auth form. ~9,800 lines added in one
session.

**Why:** Getting a functional end-to-end slice working first — CSV in,
dashboard out — before layering on more features.

---

## 2025-06-20 — RFM segment tiles added

**What:** Added RFM (Recency, Frequency, Monetary) customer segment
tiles to the dashboard, showing revenue and customer count per segment.

**Why:** Core value proposition of StrategIQ is customer segmentation —
this is the first real analytics output shown to users.

---

## 2025-06-20 — AI insights locked behind a preview

**What:** AI insights section on the dashboard now shows a locked
preview instead of full content.

**Why:** Early groundwork for a paid tier — let free users see there's
more value available without giving it away.

---

## 2025-06-20 — Revenue trends, top products, AOV added

**What:** Added revenue-over-time charts, top products list, and
average order value (AOV) trends to analytics.

**Why:** Expanding the analytics surface so the dashboard answers more
of the "what's happening in my store" questions brand owners have.

---

## 2025-06-20 — Geographic and order volume analysis added

**What:** Added top geographic locations, order volume, and customer
revenue analysis to the backend and dashboard.

**Why:** Rounding out the analytics MVP with location and volume data,
useful for brands deciding where to focus marketing spend.

---

## 2025-06-20 — Premium features gating added

**What:** Introduced a premium features section/availability flag in
both backend and `Analytics.tsx`.

**Why:** Started separating free-tier and premium-tier functionality
ahead of building out a real pricing/paywall system.

---

## 2026-05-03 — Project re-baselined, premium tiles and column mapping utilities added

**What:** New "initial commit" adding `.nvmrc`, a dedicated
`PremiumFeatures.tsx` component, `PremiumTile.tsx` UI component, and
`columnUtils.ts`. `Analytics.tsx` and `AuthContext.tsx` reworked.

**Why:** Marks a restart/re-baseline point in the repo history — premium
feature UI split out into its own components rather than living inline
in `Analytics.tsx`, and `.nvmrc` added to pin the Node version for the
team.

---

## 2026-05-15 — Supabase auth and Render backend config added

**What:** Initial Supabase auth wiring and `backend/render.yaml` added
for deploying the FastAPI backend to Render.

**Why:** Moving off local-only auth toward a real hosted backend +
managed auth/database provider (Supabase) ahead of a first deploy.

---

## 2026-05-15 — First Vercel deploy triggered, backend runtime fixes

**What:** Triggered first Vercel deployment; added `backend/runtime.txt`
and adjusted the pinned pandas version to fix a Render build issue.

**Why:** Getting the app live on real infrastructure (Vercel for
frontend, Render for backend) and unblocking a dependency/runtime
mismatch that broke the Render build.

---

## 2026-05-22 — CSV upload flow rebuilt with smart column mapping

**What:** Added `POST /api/upload/analyze-headers`, which reads a
Shopify CSV's headers and maps them to standard fields (order_id,
order_date, total_price, line_items) — first via exact match against
known Shopify column-name variants, then via fuzzy matching
(`difflib`) as a fallback. `POST /api/process-files` extended to accept
a user-confirmed `column_mapping`. `DataUpload.tsx` rewritten into a
4-step flow: upload → mapping UI (only shown if needed) → confirmation
screen → processing. Standard Shopify exports skip the mapping step
entirely.

**Why:** Not every Shopify export uses the exact same column names
(depends on export settings/locale/app used). Auto-detecting and only
asking the user to confirm mappings when detection is uncertain keeps
the common case fast while still handling edge cases.

---

## 2026-05-23 — Full production-quality auth system built

**What:** Built out the complete auth system in one session:
- 2-step sign-up form (personal info + brand details, 12+ fields),
  password strength indicator, show/hide toggles, T&C checkbox
- Login form with remember-me and forgot-password link
- Forgot-password / reset-password flows via Supabase
- Email verification screen with resend option
- First-login onboarding checklist (never shown again after first
  visit)
- Profile page: change email, change password (10-char minimum),
  delete account with "DELETE" typed confirmation
- Session persists across page refresh; user is redirected back to the
  page they originally wanted after logging in
- `AuthContext` rewritten with the full method set
- New `PasswordInput` component (Weak/Fair/Strong strength bar + eye
  toggle)
- Single Supabase client centralized in `src/lib/supabase.ts`
- SQL migration extending `profiles` with 13 new columns, RLS
  policies, and an auto-profile-creation trigger

**Why:** Auth was previously a single basic form (`AuthForm.tsx`) with
no password recovery, no email verification, and no account
management — not enough for real users. This built it out to a
complete, production-ready flow in one pass rather than bolting pieces
on incrementally.

**Decision — httpOnly cookies not used:** A Vite SPA can't use httpOnly
cookies for the session token, so Supabase's JWT is stored in
`localStorage` instead. This is a known trade-off (XSS could
theoretically read the token) but was explicitly accepted: the app is
protected by short-lived tokens, Supabase Row Level Security, and JWT
verification on every FastAPI request. Documented directly in
`AuthContext.tsx` so it isn't "rediscovered" and re-litigated later.

---

## 2026-05-23 — Fixed Supabase session-restore deadlock

**What:** Fixed a deadlock that occurred when restoring a session after
page reload.

**Why:** Supabase v2 fires its `SIGNED_IN` event from *inside* its own
internal lock (`_acquireLock`, during `initialize()`). The app's
`onAuthStateChange` callback was calling `buildUser()`, which itself
calls `getSession()` — which tries to acquire the same lock again,
creating a circular wait that hung forever. Fixed by deferring the
async work with `setTimeout(0)` so it runs after Supabase releases its
own lock, and removed a redundant parallel `getSession()` call that
was causing a second, concurrent lock acquisition under React
StrictMode.

---

## 2026-05-23 — Inline confirm-password validation added

**What:** Sign-up form now shows "Passwords don't match" in red while
typing, and "Passwords match ✓" in green once they agree — live,
before the form is submitted.

**Why:** Waiting until submit to tell someone their passwords don't
match is a common source of sign-up friction; catching it inline
reduces failed submissions.

---

## 2026-05-23 — Fixed Shopify CSV encoding and backend event-loop blocking

**What:** Two bugs fixed in the upload backend:
1. **Encoding:** Shopify's "Plain CSV for Excel" export adds a UTF-8
   BOM that `pandas.read_csv()` can't parse by default. The CSV reader
   now tries `utf-8-sig`, `utf-8`, `latin-1`, then `cp1252` in order.
2. **Event loop blocking:** `pandas.read_csv()` is synchronous. Calling
   it directly inside an `async` FastAPI handler blocked the entire
   server for every other request until the read finished. Both
   upload endpoints now run pandas work in a thread executor
   (`run_in_executor`) instead.

Also: header analysis now reads only the header row instead of the
whole file, and errors are logged instead of silently swallowed.

**Why:** Real Shopify exports (especially from Windows/Excel-based
workflows) were failing to upload, and large files were freezing the
server for all users, not just the one uploading — a correctness bug
and a scalability bug fixed together.

---

## 2026-05-23 — ES256 JWT verification added for Supabase JWKS

**What:** Backend JWT verification now supports Supabase's newer
ES256/RS256 signing keys by fetching the public key from Supabase's
JWKS endpoint (and caching it), while still falling back to the legacy
HS256 shared-secret method for older projects. If neither is
configured, auth is skipped (local dev only).

**Why:** Supabase migrated this project to its new JWT Signing Keys
system (elliptic-curve ES256 instead of the old shared-secret HS256),
which caused every upload request to fail with a 401 because the
backend only knew how to verify the old format.

---

## 2026-05-23 — Remember-me behavior confirmed working

**What:** Confirmed via automated test that "Remember me" behaves
correctly: checked (default) leaves Supabase managing the session with
auto-refresh; unchecked sets a `sessionStorage` flag that signs the
user out via `beforeunload` when the browser/tab closes.

**Why:** Verifying security-sensitive session behavior actually works
as designed, not just that it compiles.

---

## 2026-05-23 — Part 1 of user sign-on feature completed

**What:** Marked the first phase of the sign-on feature complete;
minor `DataUpload.tsx` adjustments and Vercel project linkage files
added.

**Why:** Checkpoint commit closing out the initial auth build before
moving on to route protection (part 2).

---

## 2026-07-02 — Project CLAUDE.md added

**What:** Added `.claude/CLAUDE.md` documenting the project's stack,
structure, and working conventions for Claude Code.

**Why:** Gives Claude (and future contributors) persistent context
about the project instead of re-explaining it every session.

---

## 2026-07-02 — Route protection reviewed and cleaned up (part 2 of sign-on)

**What:** Reviewed two uncommitted files — `ProtectedRoute.tsx` and
`src/pages/DashboardPage.tsx` — left over from a previous session.
Found that:
- `ProtectedRoute.tsx` was written for React Router (`Navigate`,
  `Outlet`), but the app has no React Router set up at all (no
  `BrowserRouter` in `main.tsx`) — it uses its own state-based routing
  in `App.tsx` instead.
- `App.tsx` already has full route protection working via a
  `PROTECTED` pages array and a redirect effect — it already blocks
  logged-out users from `dashboard`, `upload`, `analytics`, `premium`,
  `profile`, and `onboarding`, and remembers/restores the page they
  were trying to reach.
- `DashboardPage.tsx` (a read-only account/plan summary page) was
  redundant with an "Account Details" section that already exists in
  `ProfilePage.tsx`, sourced from `AuthContext`'s `user` object rather
  than a separate database query.

**Decision:** Keep the existing state-based routing rather than
migrating to React Router — smaller change, no new dependencies to
wire in, and the current approach already works. Deleted both
`ProtectedRoute.tsx` and `DashboardPage.tsx` (and the now-empty
`src/pages/` folder) as redundant rather than merging or extending
them.

**Why:** Introducing React Router alongside the existing router would
have meant two parallel routing systems and duplicate
dashboard/profile components — avoided by confirming with the project
owner before writing any code, per project working style.

---

## 2026-07-02 — Local dev environment fixed (Node version)

**What:** `npm run dev` was failing with `crypto$2.getRandomValues is
not a function`. Root cause: the shell's default Node version (via
nvm) was v16.20.2, but Vite 6 requires Node 20+ (the project already
has a `scripts/assert-node20.mjs` guard and `.nvmrc` for this). Node
20.20.2 was already installed via nvm — just not the active default —
so the dev server was restarted using `nvm use 20`.

**Why:** Unblocking local development; this wasn't a code bug, just an
environment mismatch.

---

## 2026-07-02 — Route protection verified end-to-end in a real browser

**What:** Ran an automated Playwright test against the local dev
server (frontend on Node 20, backend on FastAPI/port 8000) covering
the full flow: load app logged out → sign up (2-step form) → auto-login
→ redirect to protected onboarding screen → navigate to protected pages
(`upload`, `profile`) while logged in → confirm Account Details section
renders correctly → log out → confirm redirect back to the public
landing page with no protected content left in the DOM. Zero console
errors throughout.

**Why:** Confirming the protection logic actually works in the running
app, not just that it reads correctly in the source — per the project
rule to test UI changes in a browser before calling them done.

**Note:** This created two test accounts in the real (dev) Supabase
project — `claude-route-test-*@example.com` — since there's no separate
test database configured. Left in place pending a decision on cleanup.

---

## 2026-07-07 — Auth system audit: profile edit and backend data isolation fixed

Ran a full read-the-code audit of the auth system against a 7-item checklist.
Five items passed cleanly. Two were partially done and fixed in this session.

---

### Fix 1 — Profile page: edit form added (`ProfilePage.tsx`)

**What:** The Account Details card in `ProfilePage.tsx` previously only
displayed the user's data (name, plan, brand, country etc.) with no way to
change it after sign-up. Added an "Edit" button that reveals an inline form
covering: first name, last name, brand name, industry segment (pill buttons),
team size, country, currency, and phone. On submit it calls `updateProfile()`
from `AuthContext` which was already fully implemented and just waiting to be
wired up. On success the form closes and a confirmation banner appears.

**Why:** `updateProfile()` was built in May as part of the auth system but
never connected to the UI — the ProfilePage only had email/password/delete
actions. This meant users who mistyped their brand name or changed their team
size after sign-up had no way to fix it. The fix is entirely in the UI layer;
no AuthContext or Supabase changes were needed.

**Decision — kept the same toggle pattern:** The edit form uses the same
show/hide expand pattern as the existing email and password change sections,
rather than a separate settings page or modal. This keeps the page consistent
and avoids introducing navigation complexity.

---

### Fix 2 — Backend: analytics endpoints unprotected + shared data store (`main.py`)

**What:** Two related data-isolation bugs fixed in the FastAPI backend:

1. **All 8 analytics GET endpoints had no auth check.** `/api/analytics/top-products`,
   `revenue-trends`, `aov-trends`, `customer-analysis`, `geographic-analysis`,
   `order-volume-trends`, `revenue-per-customer`, and `data-insights-check` were
   openly accessible to anyone — authenticated or not — without a JWT.
   Added `_user: dict = Depends(require_auth)` to all eight.

2. **`file_processor.sales_data` was a single shared module-level attribute.**
   Every upload overwrote the same variable. If two users uploaded data, the
   second user's upload replaced the first's, and the first user's analytics
   silently showed the second user's data. Replaced with a per-user dictionary
   `_user_data: Dict[str, Any] = {}` keyed by the JWT's `sub` claim (the
   user's Supabase user ID). Upload now stores `_user_data[user_id] = combined`
   and every analytics endpoint reads `_user_data.get(user_id)` — users only
   ever see their own data.

**Why:** The upload endpoints already required a valid JWT (this was built
correctly in May) but the analytics read endpoints were missed — a classic
"write is protected, read is not" oversight. The shared data store was a
structural problem: the `FileProcessor` class was designed as a singleton for
single-user local dev, which breaks as soon as more than one user is active.
The in-memory per-user dict is the simplest correct fix for the current scale;
a persistent store (e.g. Supabase Storage or a DB-backed cache) would be
needed if the server restarts between a user uploading and viewing analytics.

**Decision — in-memory store kept for now:** Data is stored in `_user_data`
in the server process's memory rather than persisted. This means a server
restart clears all uploaded data and users have to re-upload. Acceptable for
the current early-stage product where Render spins the server up on demand
anyway. If this becomes a problem (users losing data), migrate to Supabase
Storage or a Redis cache — but that's a separate decision.

**Supabase RLS:** The `profiles` table already had correct RLS policies from
the May migration (`001_extend_profiles.sql`): SELECT, INSERT, UPDATE, and
DELETE all scoped to `auth.uid() = id`. No changes needed there.

---

## 2026-07-07 — Delete account: email could not be reused after deletion

**What:** Fixed a bug where deleting an account and trying to sign up again
with the same email produced "Email already in use." Three changes:

1. **New backend endpoint `DELETE /api/auth/account` (`main.py`)** — verifies
   the caller's JWT, then calls Supabase's Admin API
   (`/auth/v1/admin/users/{user_id}`) using the `SUPABASE_SERVICE_ROLE_KEY`
   to permanently remove the `auth.users` record. Also clears the user's
   in-memory analytics data from `_user_data`.

2. **`deleteAccount()` updated (`AuthContext.tsx`)** — now runs in three steps:
   delete the `profiles` row client-side (RLS allows it), call the backend
   endpoint to remove the auth user, then sign out and clear local state.

3. **`backend/.env.example` updated** — added `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` entries with instructions. The service role
   key must be added to `backend/.env` for deletion to work in production.

**Why:** `deleteAccount()` previously only deleted the `profiles` table row
and called `signOut()`. The actual user record in Supabase's `auth.users`
table was never touched. Supabase uses that record to track which emails are
registered, so the email stayed reserved even after the account appeared
deleted. Removing from `auth.users` requires the service_role key, which
must never be in the browser — hence the backend endpoint.

**Decision — backend endpoint over Edge Function:** A Supabase Edge Function
could also do this, but the FastAPI backend already has the service_role key
pattern in place for JWT verification. Keeping the deletion there avoids
adding another runtime (Deno) to the stack.

---

## 2026-07-07 — Landing page: separate sign-up and log-in paths

**What:** The landing page previously had one `onGetStarted` callback wired
to the login page everywhere — the header button, hero CTA, and all pricing
plan buttons. Changed in two files:

- **`LandingPage.tsx`** — added `onLogin` prop alongside `onGetStarted`.
  Header nav now shows a plain "Log in" text link next to the "Get Started"
  button. All other CTAs ("Start Free Trial", plan buttons) continue to use
  `onGetStarted`.

- **`App.tsx`** — `onGetStarted` now routes to `'signup'` instead of
  `'login'`. Passes the new `onLogin` prop routing to `'login'`.

**Why:** A new visitor hitting "Get Started" or "Start Free Trial" intends to
create an account — sending them to the login form first added unnecessary
friction. Existing users had no obvious route to log in from the landing page
without going through the sign-up flow first. The login link in the nav is
styled as a secondary text link so it's visible without competing with the
primary CTA.

---

## 2026-07-07 — Analytics page: charts and data not loading

**What:** All 8 analytics API calls in `Analytics.tsx` were missing the
`Authorization: Bearer <token>` header. When we added `require_auth` to every
analytics backend endpoint earlier this session, those calls started returning
401 and failed silently — the charts and detailed data just didn't show up.
Fixed by adding the same `authHeader()` helper used in `DataUpload.tsx` (calls
`supabase.auth.getSession()` and returns the header map) and passing the result
as the `headers` option to every `fetch()` call in `fetchAnalyticsData()`.
Also imported `supabase` from `AuthContext` so the helper could access the
session.

**Why:** A classic "forgot to update the frontend after tightening the backend"
mistake. The upload endpoints were already sending auth headers because they
were written after auth was required. The analytics fetch calls were written
earlier when those endpoints were open, so the header was never added. Adding
auth to the backend without auditing all callers left a gap.

---

## 2026-07-07 — SUPABASE_SERVICE_ROLE_KEY added to backend/.env

**What:** Added `SUPABASE_SERVICE_ROLE_KEY` to `backend/.env`. The key is found
in the Supabase dashboard under Project Settings → API → Project API keys →
`service_role`. Also needs to be set as an environment variable in Render
(Environment tab on the backend service) for production account deletion to work.

**Why:** The `DELETE /api/auth/account` endpoint added earlier this session
requires the service role key to call Supabase's Admin API and permanently
remove the `auth.users` record. Without it the endpoint returns 501 and account
deletion fails. The key must only ever live server-side — it bypasses all RLS
and can read/write anything in the database.

**Decision — not committed to git:** `backend/.env` is gitignored. The key must
be set manually in each environment (local and Render). `backend/.env.example`
documents the variable name and where to find it so it isn't forgotten.

---

## 2026-07-07 — Data upload v2: full rewrite of the upload pipeline

**What:** Complete replacement of the v1 upload flow. No protected files were
modified. All changes are additive — new files only (new routes module, new shared
modules, new frontend component) plus wiring into existing entry points.

### Backend changes

**`backend/shared/state.py`** (new)
Shared in-memory state module: `_user_data` dict and `_user_sample_mode` dict.
Both main.py and upload_v2.py import from here so they reference the same dict
instance. Python module-level mutable objects are shared by reference — this is
intentional and is how per-user data is passed between the v1 analytics endpoints
(in main.py) and the v2 upload endpoint.

**`backend/shared/auth.py`** (new)
Extracted `require_auth` FastAPI dependency from main.py into a shared module to
avoid a circular import (upload_v2.py → main.py → upload_v2.py). Both files now
import from shared.auth instead. The logic is unchanged — ES256 (JWKS) + HS256
(legacy) JWT verification returning the payload dict with the user's `sub` claim.

**`backend/services/supabase_service.py`** (new)
Supabase REST API helpers using urllib (no requests library — not in
requirements.txt). Handles db_insert, db_upsert, db_select, db_update,
db_delete, storage_upload, storage_delete, storage_download. Uses
SUPABASE_SERVICE_ROLE_KEY from the environment — never exposed to the browser.
Bucket: `strategiq-uploads`. Storage conflict (HTTP 409) retried with PUT.

**`backend/sample_data/shopify_sample.csv`** (new)
48-record realistic Shopify clothing brand dataset bundled with the app.
Identical to the baseline test CSV. Used by the "Try with sample data" endpoint.

**`backend/routes/upload_v2.py`** (new)
Full v2 router mounted at `/api/upload/v2`. Key design decisions:
- Column mapping confidence: "high" = exact variant match, "medium" = fuzzy ≥0.75,
  "low" = fuzzy <0.75. Uses difflib.SequenceMatcher.
- Row validation: BLOCKING_COLS = [order_id, total, order_date] (missing = error),
  WARN_COLS = [product_name] (missing = warning). Row numbers are 1-based.
- Encoding cascade: utf-8-sig → utf-8 → latin-1 → cp1252, with the used
  encoding returned to the frontend so the user can see it.
- Duplicate detection: order_id collision treated as warning, not error; first
  occurrence kept.
- Saved mapping: upserted to user_column_mappings table (one row per user).
  Returned on analyze-headers so the next upload pre-fills the mapping UI.
- Upload history: every process call writes a row to upload_history, including
  the Supabase Storage path for later reload.
- Sample data: stored in _user_sample_mode[user_id]; clears on DELETE.

**`backend/main.py`** (modified — NON-PROTECTED SECTIONS ONLY)
Added shared module imports and alias (`_user_data = _shared_user_data`),
fixed _SUPABASE_URL reference in account-deletion endpoint (now a local var),
and mounted the v2 router. make_json_safe and safe_divide were NOT touched.

**`supabase/migrations/20260707_upload_v2.sql`** (new)
Two new tables:
- `upload_history`: tracks every upload per user (file, size, row count, status,
  storage path, sample flag). RLS: users read their own rows only.
- `user_column_mappings`: one row per user storing their confirmed column mapping
  as JSONB. RLS: users read their own row only.
Backend writes via service role key (bypasses RLS); no client-side writes.

### Frontend changes

**`src/types/index.ts`** (appended)
New TypeScript types: ConfidenceLevel, V2AnalyzeHeadersResponse, RowError,
DuplicateRow, V2ProcessResponse, UploadHistoryEntry, V2HistoryResponse,
V2SavedMappingResponse, V2SampleStatusResponse, DataUploadV2Props.

**`src/components/upload/DataUploadV2.tsx`** (new)
Complete 9-step wizard component:
- upload → sheet-select → mapping → preview → uploading → processing → errors
  → success → history
- XHR used for real upload % progress (fetch API does not expose upload.onprogress).
- Encoding notification shown on the preview screen.
- Column mapping: confidence badge (Auto-detected / Best guess / Uncertain) per
  field. Required fields (order_id, order_date, total_price) must be mapped before
  proceeding. Optional field (line_items) can be skipped.
- Preview: first 10 rows in a scrollable table. "Looks right — process" or
  "Fix mapping" buttons.
- Processing: four stage indicators (Reading → Detecting → Validating → Ready).
- Errors: row errors and duplicates separated; downloadable CSV error report.
  Blocking errors prevent "Continue anyway"; warnings allow it.
- Success: confirmation screen with row count, encoding, timestamp.
- History: all uploads listed with age (daysAgo), status badge, "Use this" to
  reload, and delete button.
- Sample data: "Try with sample data" button on upload screen; persistent amber
  banner while active; "Remove sample" link.

**`src/App.tsx`** (modified)
Switched import from DataUpload to DataUploadV2. Added isSampleData and
uploadedAt state. handleProcessedData now accepts (data, uploadedAt, isSampleData).
Added handleClearSampleData. Passes all three new props to Dashboard.

**`src/components/dashboard/Dashboard.tsx`** (modified)
Added uploadedAt and isSampleData props. Shows "Last upload: X days ago"
freshness indicator at the top when real data is loaded. Shows amber sample data
banner when isSampleData is true.

### Protected files — not modified

make_json_safe, safe_divide (main.py), clean_dataframe (data_cleaner.py),
AnalyticsService (analytics.py), and validators.py were all untouched.
upload_v2.py has its own local `_json_safe()` helper (same logic) rather than
importing from main.py to avoid the circular import.

The 48-record baseline was run before any v2 code was written and outputs saved
to baseline-tests/baseline-outputs.json. Because no protected files were changed,
a re-run is not strictly required, but the baseline directory is committed so it
can be re-run at any time to confirm the pipeline is unchanged.

---

## 2026-07-07 — Customer identifier: support customer_id and other non-email identifiers

**What:** Three files changed to support datasets that identify customers by ID rather than email.

**`backend/services/analytics.py`** (protected file — modified)
Added `_customer_col()` helper method to `AnalyticsService`. Returns `'customer_email'` if present in the dataframe, else `'customer_id'`, else `None`. Replaced four hardcoded `'customer_email'` references in `_count_active_customers`, `_calculate_churn_risk`, `_segment_customers`, and `_simple_segment_fallback` with `self._customer_col()`. No protected functions (`safe_float`, `safe_int`, timezone handling) were touched — only business logic in the four customer-counting/segmentation methods.

**`backend/routes/upload_v2.py`** (non-protected)
Added `customer_identifier` as a 5th entry in `CRITICAL_FIELDS` with variants covering email, customer_id, user_id, client_id, buyer_id, member_id, account_id, etc. Added corresponding `FIELD_LABELS`, `FIELD_DESCRIPTIONS`, `FIELD_MISSING_MESSAGES`. Added `"customer_identifier": "customer_email"` to `FIELD_TRANSLATE` — when the user maps any column as their customer identifier, it gets renamed to `customer_email` before entering the pipeline, which is what analytics.py reads.

**`src/components/upload/DataUploadV2.tsx`** (non-protected)
Added `'customer_identifier'` to the `CRITICAL_FIELDS` array. Left out of `BLOCKING_FIELDS` (warning only, not hard-blocking) — datasets without any detectable customer identifier can still be processed for revenue and order analytics, they just won't have customer counts or segments.

**Why:** Shopify exports always include `email`. But non-Shopify datasets (or anonymised exports) use numeric or string customer IDs. Previously `analytics.py` hardcoded `customer_email` everywhere — any dataset without that exact column got `active_customers=0` and empty segments. The fix makes the analytics work with whatever unique customer identifier is present, without requiring the user's data to have an email column.

**Testing:** Baseline re-run confirmed unchanged: `4476.79 / 20 / 93.27 / 0.0% / 8` (baseline uses `customer_email` — existing path unaffected). Separate test with a `customer_id`-only dataset of 5 rows / 3 unique customers: `active_customers=3`, `segments=3` — correct.

---

## 2026-07-07 — Data upload v2: full rewrite of the upload pipeline

**What:** Complete replacement of the v1 upload flow. No protected files were
modified. All changes are additive — new files only (new routes module, new shared
modules, new frontend component) plus wiring into existing entry points.

**Why:** The v1 upload flow had no progress feedback, no column confidence
indicators, no preview, no error reporting, no history, no sample data mode, no
duplicate detection, and no file storage. The v2 rebuild delivers all of these
while keeping the same v1 analytics backend working unchanged.

---

## 2026-07-07 — Fix: non-email customer IDs dropped all rows; DD/MM dates silently wrong

**Root cause 1 — all rows dropped:** `FIELD_TRANSLATE` in `upload_v2.py` mapped `customer_identifier` → `customer_email`. So when a dataset had a `customer_id` column (numeric IDs like `10000055`), the pipeline renamed it to `customer_email`. The data cleaner then applied its `@` filter: `df = df[df['customer_email'].str.contains('@', na=False)]` — removing every row since no numeric ID contains `@`. Result: empty DataFrame → "No valid data after cleaning" error.

**Root cause 2 — silent date corruption:** `pd.to_datetime()` was called without `dayfirst=True`. Dates in `DD/MM/YYYY` format (common in European/non-Shopify datasets, e.g. `15/02/2023`) were either silently converted to wrong values (day ≤ 12 treated as month) or became `NaT` (day > 12 can't be a valid month). All date-based analytics (trends, churn, segments) would be wrong.

**Fixes:**

**`backend/routes/upload_v2.py`** (non-protected)
Changed `FIELD_TRANSLATE["customer_identifier"]` from `"customer_email"` to `"customer_id"`. The CSV column now keeps its identity as `customer_id` through the pipeline. `_customer_col()` in analytics.py already handles both `customer_email` and `customer_id`.

**`backend/services/data_cleaner.py`** (protected — modified with care)
Replaced the bare `pd.to_datetime(series, errors='coerce')` in `clean_date_column()` with a format-detection approach: tries both `dayfirst=False` and `dayfirst=True`, returns whichever yields fewer `NaT` values. This correctly handles US (`MM/DD`), EU/UK (`DD/MM`), and ISO (`YYYY-MM-DD`) date formats without guessing. The inline call in `clean_dataframe()` now calls `DataCleaner.clean_date_column()` instead of duplicating the logic. No null/zero handling, currency cleaning, or other protected logic was touched.

**`src/components/upload/DataUploadV2.tsx`** (non-protected)
Updated frontend `FIELD_TRANSLATE` constant to match: `customer_identifier: 'customer_id'`.

---

## 2026-07-07 — Fix: onboarding shown on every login for returning users

**Root cause (three bugs working together):**
1. `logout()` in `AuthContext.tsx` was calling `localStorage.removeItem(`strategiq_seen_${user.id}`)` — clearing the seen flag on every logout. So on the next login, both the database flag (`has_seen_onboarding`) and localStorage were empty, making `hasSeenOnboarding = false` for every returning user.
2. `buildUser()` had no fallback for existing profiles where the `has_seen_onboarding` column is `null` (accounts created before the column was added).
3. `App.tsx` routing: logging out while on the onboarding page set `intendedPage = 'onboarding'` (because `'onboarding'` was in `PROTECTED`). On next login, even with `hasSeenOnboarding: true`, the user was routed back to onboarding via `intendedPage`.
4. `OnboardingScreen.tsx`: `useEffect(() => { markOnboardingSeen(); }, [])` captured a stale closure — `markOnboardingSeen` closing over a null `user` at initial render, so `if (!user) return` bailed early and the flag was never saved.

**Fixes:**

**`src/App.tsx`**
Removed `'onboarding'` from `PROTECTED` array so logging out from the onboarding screen no longer sets `intendedPage = 'onboarding'`. Added a guard in the login redirect: if `intendedPage === 'onboarding'`, fall back to `'upload'` instead.

**`src/contexts/AuthContext.tsx`** — `buildUser()`
Added a time-based fallback: if the account is older than 10 minutes, `hasSeenOnboarding` defaults to `true` regardless of DB/localStorage state. This covers all existing profiles that predate the `has_seen_onboarding` column. The 10-minute window is generous enough to cover the signup → email verify → first login flow for genuinely new accounts.
Also fixed `brandDetailsComplete` to derive from individual profile fields (`brand_name`, `industry_segment`, `country`) rather than relying solely on the `brand_details_complete` flag — so existing profiles with all fields filled show the checklist item as done without a re-save.

**`src/contexts/AuthContext.tsx`** — `logout()`
Removed the `localStorage.removeItem(`strategiq_seen_${user.id}`)` call. The seen flag must survive across sessions. It is still cleared on full account deletion.

**`src/components/onboarding/OnboardingScreen.tsx`**
Changed `useEffect` dependency from `[]` to `[user?.id]` so `markOnboardingSeen()` is called once the user object is actually loaded, not on initial render when the closure may still hold a null user.

**`src/App.tsx`** — `handleProcessedData`
Added `markCsvUploaded()` call after a real (non-sample) upload completes, so the "Upload CSV" checklist item marks as done on the onboarding screen.

---

## 2026-07-07 — Delete v1 upload: DataUpload.tsx and legacy routes

**What removed:**
- `src/components/upload/DataUpload.tsx` — the entire v1 upload component (file deleted)
- `export interface DataUploadProps` — removed from `src/types/index.ts`
- `POST /api/upload/analyze-headers` — removed from `backend/main.py` (369 lines)
- `POST /api/process-files` — removed from `backend/main.py`

**Why:** v2 upload (`DataUploadV2.tsx` + `routes/upload_v2.py`) is fully wired and tested end-to-end. Keeping v1 alongside it created confusion and dead code. No other file imported v1 components at the time of deletion — `App.tsx` was already using `DataUploadV2`.

---

## 2026-07-07 — Fix: analytics routes hardcoded customer_email; top products missing quantity

**Root causes:**

1. **Top Products empty:** `get_top_products()` required `quantity` in the DataFrame. Non-Shopify datasets use `order_quantity` (not recognized by auto-detection). Also, `unit_price` was hardcoded in the groupby `agg()` — if `product_price` wasn't detected as `unit_price`, it caused a KeyError.

2. **Returning vs New Customers empty / Unique customers not shown:** Five analytics routes (`customer-analysis`, `revenue-per-customer`, `geographic-analysis`, `data-insights-check`, and the repeat-purchase check) all hardcoded `if 'customer_email' not in df.columns → error`. After the `FIELD_TRANSLATE` fix (customer_identifier → customer_id), non-Shopify datasets have no `customer_email` column — every one of these routes returned "Required columns missing".

**Fixes:**

**`backend/routes/upload_v2.py`** — `_run_pipeline`
Added a `_EXTRA_RENAMES` normalization step after user mapping, before auto-detection. Renames: `order_quantity` → `quantity`, `order_qty` → `quantity`, `lineitem_quantity` → `quantity`, `product_price` → `unit_price`, `item_price` → `unit_price`, `price_per_item` → `unit_price`, `order_price` → `unit_price`. Only applied when the source column exists and the target name isn't already present.

**`backend/main.py`** — `get_top_products()`
Made `quantity` and `unit_price` optional: builds the `agg()` dict dynamically based on which columns exist. Falls back to 0 for missing quantity/price in the response.

**`backend/main.py`** — `get_customer_analysis()`, `get_revenue_per_customer()`, `get_geographic_analysis()`, `check_data_insights_availability()`
Replaced all hardcoded `'customer_email'` checks with a dynamic `cust_col` variable: uses `customer_email` if present, otherwise `customer_id`, otherwise returns an error. All groupby, merge, and column reference operations use `cust_col` throughout. `make_json_safe` and `safe_divide` in main.py were not touched.

---

## 2026-07-07 — Feature: customer preprocessing pipeline

**What added:**

**`backend/services/customer_insights.py`** (new file)
Full customer-level aggregation service. Takes a cleaned order-level DataFrame and produces:
- Per-customer core fields: total_revenue, order_count, aov, first/last_order_date, days_since_last_order, customer_lifetime_days, purchase_frequency, total_quantity_purchased, distinct_products_purchased, total_discount_amount, discount_usage_rate, refund_total, net_revenue, avg_days_between_orders, first_product_purchased, most_bought_product.
- 9 boolean behavioural flags: is_repeat_customer, is_one_time_buyer, is_at_risk, is_lapsed, is_discount_dependent, is_full_price_loyal, is_high_value, is_high_return_risk, is_new_customer.
- 3 action fields per customer (recommended_action, action_reason, action_priority) using 6 priority rules + default fallback.
- Weekly grouped summary via `build_weekly_summary()`, sorted high → medium → low priority.
- Input validation: rows with blank customer_id/email are skipped and counted.
- All columns are optional (graceful degradation when quantity, product, discount, or refund data is absent).

**`backend/routes/insights.py`** (new file)
Two GET endpoints:
- `GET /api/insights/customers` — returns customer-level data from Supabase cache
- `GET /api/insights/action-summary` — returns weekly action summary from Supabase cache

**`supabase/migrations/20260707_customer_insights.sql`** (new migration — must be run in Supabase SQL editor)
Creates `customer_insights_cache` and `action_summary_cache` tables. One row per user (UNIQUE constraint on user_id enables upsert). JSONB storage avoids per-row bulk insert complexity. RLS: users read/update own row; service role has full access.

**`backend/routes/upload_v2.py`**
- Added import: `build_customer_insights`, `build_weekly_summary`
- Added `_customer_col(df)` helper (returns customer_email > customer_id > None)
- Added `_run_insights_pipeline(df_clean, user_id, upload_id)` helper — calls insights service, upserts results to both Supabase tables, returns skipped_count
- Process route now calls `_run_insights_pipeline` in executor after `_build_metrics`, adds `skipped_customers` to response

**`backend/main.py`** — added router include for `/api/insights` (not a protected-function change)

**`src/types/index.ts`** — added CustomerInsight, CustomerInsightsResponse, ActionSummaryGroup, ActionSummaryResponse, V2ProcessResponseWithInsights, ActionPriority

**`src/components/upload/DataUploadV2.tsx`** — added 'Calculating customer insights' to the processing stages list

**Why:** Core analytics pipeline extension. Customer-level segmentation and recommended actions are the strategic output layer of StrategIQ — turning raw order data into per-customer next steps and a weekly priority queue for the brand owner.

**Protected files touched:** None. `make_json_safe` and `safe_divide` in main.py were not modified. `data_cleaner.py`, `analytics.py`, `validators.py`, `core_config.py` were not touched.

---

## 2026-07-07 — Dashboard major upgrade: polished segment, action, and insight UI

**What added:**

**Backend:**

- **`backend/services/insights_generator.py`** (new) — full scored insight bank. Six categories: `retention_risk`, `growth_opportunity`, `discount_inefficiency`, `cohort_quality`, `customer_concentration`, `product_concentration`. Each insight has: headline, explanation, revenue_at_stake, affected_count, confidence (high/medium/low), suggested_action, flag_citations, data_logic (for "Explain this"), score (0–100), and customer_keys (up to 200 email/IDs for drill-through). Score = confidence_score × 40 + revenue_share × 40 + actionability × 20.

- **`backend/services/customer_insights.py`** (updated) — `_assign_action` now returns 5 values: added `suggested_channel` (Email / Personal outreach / Ads / Regular comms) and `suggested_timing` (Immediately / This week / This month / Next campaign / Ongoing). `build_weekly_summary` includes these in each group dict. `build_customer_insights` stores both new columns on the customer DataFrame.

- **`backend/routes/upload_v2.py`** — `_run_insights_pipeline` extended to: (1) read previous `action_summary_cache` before overwriting for trend comparison, (2) stamp each customer with their `_segment` field, (3) enrich segments with revenue_pct/delta_customers/delta_revenue/benchmark_note/description/why/how_to_treat/typical_pct, (4) compute revenue_at_risk + revenue_opportunity, (5) generate "what changed" narrative (2-3 sentences), (6) call `generate_insight_bank`, (7) upsert full insight bank to `insights_cache`. Imports added: `_assign_segment`, `generate_insight_bank`, `SEGMENT_BENCHMARKS`.

- **`backend/routes/insights.py`** (full rewrite) — new endpoints: `GET /bank` (scored insight bank), `GET /action-state` (done/snoozed state), `POST /action-state` (update state), `GET /segment-customers/{name}` (customers in a segment), `GET /action-customers/{key}` (customers for an action group), `GET /download/segment/{name}` (CSV), `GET /download/action/{key}` (CSV), `GET /download/insight/{id}` (CSV), `GET /download/all` (ZIP of all three CSVs named `strategiq-{section}-{date}.csv`).

- **`supabase/migrations/20260707_action_state_insights.sql`** (new) — two new tables: `action_state` (mark-done + snooze per user per action_key, UNIQUE(user_id, action_key), RLS) and `insights_cache` (full insight bank JSONB, UNIQUE(user_id), RLS + service role bypass).

**Frontend:**

- **`src/components/dashboard/SegmentCard.tsx`** (new) — coloured segment card with: hover/focus info tooltip (definition, why it matters, how to treat, healthy range), trend arrows (↑↓ delta_customers + delta_revenue vs previous upload), revenue % badge, benchmark callout, click → opens segment modal. Keyboard accessible (Enter/Space).

- **`src/components/dashboard/SegmentModal.tsx`** (new) — full customer list modal for a segment. Fetches from `/api/insights/segment-customers/{name}`. Columns: email/ID, total spent, orders, last order, recommended action. Sorted by revenue desc. Header shows segment colour. Download CSV button per segment.

- **`src/components/dashboard/ActionsList.tsx`** (new) — full action group list. Features: filter by priority (all/high/medium/low), expandable rows showing customer sub-table (top 20), suggested channel + timing badges per row, mark-as-done toggle (persists to Supabase `action_state`), snooze-until-next-upload (compares `snooze_upload_id` to current `uploadId` — expires automatically when upload_id changes), per-row CSV download, monitor group shown at bottom in muted style, empty state with encouragement.

- **`src/components/dashboard/InsightBank.tsx`** (new) — scored insight bank. Features: top 3 by default, "See all insights" expands full ranked list, each card shows category icon + badge, confidence badge, headline, explanation, revenue at stake, affected count, suggested action box, "Explain this" toggle (shows data_logic), per-insight CSV download, flag citation chips, refresh timestamp.

- **`src/components/dashboard/Dashboard.tsx`** (major refactor) — uses new components. Added: `useAuth` for user currency (fixes hardcoded USD), "What changed" banner (purple, 2-3 sentences from pipeline), revenue-at-risk + revenue-at-opportunity headline cards (red/green), total customers + total revenue above segment grid, `<SegmentCard>` grid (with tooltips), `<SegmentModal>` on segment click, `<ActionsList>` (replaces compact list), `<InsightBank>` (replaces mock 3-card display), "Download everything (ZIP)" button, correct currency throughout.

- **`src/types/index.ts`** (appended) — new types: `InsightSegment` (enriched with delta/benchmark fields), `ActionGroup` (with channel/timing), `ActionSummaryFull`, `ActionState`, `InsightConfidence`, `InsightCategory`, `BankInsight`, `InsightBankResponse`, `SegmentCustomer`, `ActionCustomer`.

**Protected files touched:** None. All downloads are server-generated and auth-checked (service role key + `auth.uid()` via `require_auth`). All new tables have RLS. No changes to `make_json_safe`, `safe_divide`, `data_cleaner.py`, `analytics.py`, `validators.py`, or `core_config.py`.

**Decision — JSONB storage for insights_cache:** Each insight contains a `customer_keys` array (up to 200 customer emails/IDs). The full insight bank is stored as a single JSONB blob per user — one row — rather than individual rows per insight. This keeps the API a single-row fetch and avoids bulk insert complexity. Download endpoints do a fresh in-memory filter against `customer_insights_cache.data_json` at request time rather than denormalising the customer data into the insights table.

**Decision — snooze_upload_id comparison:** Snooze state stores the `upload_id` it was created for. When loading action groups, if `snooze_upload_id !== current_upload_id`, the snooze is considered expired (new data was uploaded). This gives true "snooze until next upload" semantics without a cron job or cleanup step.

**Future (logged, not built):** Shareable read-only insight link per insight (auth-gated, expires 7 days) — to be built as a Supabase Edge Function generating a short-lived signed URL. See DECISION_LOG.md entry when implemented.

---

## 2026-07-08 — Recommendation Engine v1 architecture and strategic output layer

**What changed:**

Implemented a new recommendation system in `backend/services/` that replaces simple action lists with a structured, end-to-end decision pipeline designed for Shopify fashion brands.

**New services and models introduced:**

- **`backend/services/recommendation_models.py`** (new)  
  Added strongly typed shared models for the full pipeline, including:
  - Core recommendation entities: `Recommendation`, `Insight`, `RecommendationResult`, `ScoredRecommendation`
  - Explanation and scoring entities: `RecommendationExplanation`, `RecommendationScore`
  - Customer context entities: `CustomerProfile`, `BehaviourFlags`, `CustomerValue`, `DiscountBehaviour`, `ReturnBehaviour`, `PurchaseCadence`, `LifecycleStage`
  - Weekly plan entities: `GrowthPlanAction`, `GrowthPlanSection`, `WeeklyGrowthPlan`
  - Enums for categories, priority, channels, timing, effort, and impact

- **`backend/services/recommendation_bank.py`** (new)  
  Added a structured recommendation catalogue for Shopify fashion brands with 22 recommendations.  
  Every recommendation includes `id`, `title`, `description`, `category`, `priority`, `timing`, `channel`, `lifecycle_stages`, `trigger_conditions`, `estimated_impact`, and `estimated_effort`.

- **`backend/services/insight_bank.py`** (new)  
  Added a structured portfolio insight catalogue with 25 insights across:
  `Retention Risk`, `Revenue Opportunity`, `Discount Inefficiency`, `Loyalty`, `Cross Sell`, `Upsell`, `Inventory`, `Returns`, and `Customer Growth`.

- **`backend/services/customer_profile_builder.py`** (new)  
  Added conversion from customer row data into normalized `CustomerProfile` objects with derived lifecycle stage.

- **`backend/services/decision_engine.py`** (new)  
  Implemented multi-attribute recommendation matching:
  - Evaluates lifecycle, segment context, behaviour flags, customer value, discount behaviour, return behaviour, and purchase cadence
  - Uses explicit trigger operators (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`)
  - Returns all matching recommendations without ranking

- **`backend/services/scoring.py`** (new)  
  Implemented ranking logic with component scores for:
  - Urgency
  - Business Impact
  - Confidence
  - Customer Value  
  Produces weighted total score and sorts highest-first.

- **`backend/services/explanation_engine.py`** (new)  
  Implemented human-readable rationale generation for each recommendation:
  - why selected
  - supporting customer behaviour
  - commercial importance
  - expected outcome

- **`backend/services/opportunity_score.py`** (new)  
  Added 0-100 Opportunity Score based on:
  - customer value
  - urgency
  - likelihood of conversion
  - expected commercial impact

- **`backend/services/weekly_growth_plan.py`** (new)  
  Added aggregation layer that converts customer-level outputs into one business plan with four sections:
  - Protect Revenue
  - Grow Revenue
  - Improve Margin
  - Strengthen Loyalty  
  Each section includes customer count, estimated commercial value, recommended actions, and supporting customer IDs.

- **`backend/services/recommendation_engine.py`** (new)  
  Wired the full orchestration pipeline:
  Recommendation Bank → Decision Engine → Scoring → Explanation → Opportunity Score → Weekly Growth Plan.  
  Added run methods for single customer, multiple customers, and row-based execution.

- **`docs/RECOMMENDATION_ENGINE.md`** (new)  
  Added full technical documentation covering architecture, flow, lifecycle, scoring, opportunity score, weekly plan design, and extension points.

**Why this architecture was introduced:**

The previous approach surfaced analytics and tactical suggestions but did not provide a unified commercial decision layer. The new architecture introduces a deterministic, extensible pipeline that converts customer behaviour into prioritized actions with explicit urgency and value-at-stake, making StrategiQ operational rather than descriptive.

**Why recommendation data is separated from business logic:**

Separating the catalogue (`recommendation_bank.py`, `insight_bank.py`) from execution logic (`decision_engine.py`, `scoring.py`, etc.) allows recommendations to evolve without rewriting engine code, improves testability, and keeps the matching/scoring pipeline stable as strategy content changes.

**Why the Weekly Growth Plan became the primary output:**

Merchants need one actionable plan per week, not fragmented metrics. The Weekly Growth Plan consolidates customer-level recommendations into clear commercial priorities (protect, grow, margin, loyalty), with counts and estimated value, so teams can execute immediately.

**How this enables future AI-generated recommendations:**

The current pipeline is structured around typed recommendation objects, trigger conditions, scores, and explanations. This creates a safe contract for future AI generation: AI can propose new recommendation templates/insights while deterministic engines still validate triggers, rank outputs, and present consistent explanations.

**How this supports additional industries later:**

Industry specifics are isolated in recommendation/insight catalogues and trigger semantics, while orchestration remains generic. To support another vertical, we can add a new catalogue and profile-mapping rules without replacing the core decision, scoring, explanation, opportunity, or weekly-plan engines.

---

## 2026-07-08 — Fix: tailored per-customer explanations wired to the UI

**What was broken:** The Recommendation Engine already generated a personalised explanation per customer (real spend, order count, days overdue), but it never reached the customer. `_apply_recommendation_engine` in `backend/routes/upload_v2.py` only read `result.recommendations[0].recommendation` (the generic catalogue title) and discarded `.explanation`. Meanwhile `action_reason` — the field meant to carry a "why" — was still being filled by an old pre-engine rule-based function (`_assign_action` in `customer_insights.py`) that could describe a completely different rule than the one actually assigned, and in one branch recommended "call, don't email" — a direct violation of the Recommendation Engine's own channel rules. On top of that, `ActionsList.tsx` didn't render the `reason` field at all, even though the type and API already carried it.

**What changed:**

- `backend/routes/upload_v2.py` — `_apply_recommendation_engine` now captures the full `ScoredRecommendation` per customer and writes `explanation.summary` into `action_reason`, overwriting the stale legacy text.
- `backend/routes/insights.py` — `action_reason` added to the segment-customers response and segment CSV export (previously only the action-customers endpoint/CSV had it).
- `src/types/index.ts` — added `action_reason?: string` to `SegmentCustomer`.
- `src/components/dashboard/ActionsList.tsx` — expanded action rows now show each customer's personalised reason under their name.
- `src/components/dashboard/SegmentModal.tsx` — the action badge shows the tailored reason as a hover tooltip.

Left `_assign_action` in place — its output is now fully overwritten downstream, so it's inert rather than actively wrong. Removing it is a separate cleanup.

---

## 2026-07-08 — Fix: stale Supabase cache overriding fresh segment/session data

**Root cause:** `GET /api/insights/segments` returned segments straight from `action_summary_cache.summary_json.segments` without recomputing, so once that cache was written (e.g. with `is_lapsed` computed against an old reference date), every later read kept showing the same stale segment assignment — including "everyone looks Lapsed" — until a fresh upload overwrote the row. A second, more severe issue was found while fixing this: `backend/routes/insights.py` imported `_user_active_upload_id` and `_user_session_insights` from `backend/shared/state.py`, but those two dicts were never defined there — a hard `ImportError` that broke the entire insights router on every backend restart or branch switch, which is what actually produced the "UI keeps reverting" symptom.

**What changed:**

- `backend/shared/state.py` — added the missing `_user_active_upload_id: Dict[str, str]` and `_user_session_insights: Dict[str, Dict[str, Any]]`, fixing the ImportError.
- `backend/routes/upload_v2.py` — `_run_insights_pipeline` now stores its result dict into `_user_session_insights[user_id]` and stamps `_user_active_upload_id[user_id]` at the end of every successful run, so reads immediately after an upload (same process) see fresh data without a Supabase round-trip. `DELETE /sample-data` clears both dicts alongside the existing `_user_data`/`_user_sample_mode` cleanup.
- `backend/routes/insights.py`:
  - `GET /segments` no longer returns cached segments directly. It always recomputes from `_fetch_customers()` (which runs `refresh_customer_flags()` to reassign `is_lapsed`/`is_at_risk`/etc. against the current reference date) via the existing `_segments_from_customers()` helper, using cached data only to merge in benchmark/trend metadata by segment name — never as the source of counts.
  - `GET /customers` now runs `refresh_customer_flags()` on the cached rows before returning instead of serving `data_json` as-is.
  - `GET /action-summary` and `GET /bank` now go through `_fetch_action_summary_row()` / `_fetch_insights_row()` (already written, previously unused) which check in-memory session state before falling back to Supabase, instead of doing a bare `db_select` — closing the same staleness gap consistently.
  - `_fetch_insights()` (used by the insight/zip CSV downloads) now also checks session memory first.
  - Removed the now-unused `_SEGMENT_ORDER` constant left behind by the `get_segments` rewrite.

**Why in-memory session state is enough (no frontend change needed):** `Dashboard.tsx` already passes the just-uploaded data down as `sessionInsights` and only lets a subsequent `GET /api/insights/segments` / `/action-summary` / `/bank` override it when that call succeeds. Since those endpoints now check `_user_session_insights` (populated synchronously at the end of the same upload request, before Supabase) before ever touching the database, they return fresh data immediately, so the fresh upload response is no longer clobbered — without touching frontend data-fetching logic.

**Known limitation:** `_user_session_insights` is process-local. If the backend ever runs multiple worker processes, an upload handled by one worker won't be visible in another worker's memory, and reads would fall back to Supabase (which is still correct, just without the same-process fast path). This matches the existing pattern for `_user_data`/`_user_sample_mode` and wasn't introduced by this fix.

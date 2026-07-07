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

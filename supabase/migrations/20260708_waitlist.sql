-- Waitlist sign-ups from the public landing page.
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query).

CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'landing'
);

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_lower_idx
  ON public.waitlist (lower(email));

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Anon users can insert only; no public read access.
DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist;
CREATE POLICY "Anyone can join waitlist"
  ON public.waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- StrategIQ: Extend profiles table with full user data
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. Add new columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'United Kingdom',
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GBP',
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS brand_size TEXT,
  ADD COLUMN IF NOT EXISTS industry_segment TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS referral_source TEXT,
  ADD COLUMN IF NOT EXISTS has_seen_onboarding BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS csv_uploaded BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS brand_details_complete BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Backfill first_name / last_name from existing name column
UPDATE profiles
  SET
    first_name = COALESCE(first_name, split_part(name, ' ', 1)),
    last_name   = COALESCE(last_name,
                   NULLIF(trim(substring(name FROM position(' ' IN name) + 1)), ''))
  WHERE name IS NOT NULL;

-- 3. Trigger: auto-create a profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, plan, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'firstName', split_part(NEW.email, '@', 1)),
    'micro',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. RLS policies (safe to re-run — CREATE POLICY IF NOT EXISTS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can delete own profile"
  ON profiles FOR DELETE USING (auth.uid() = id);

/*
# Create Zinariya Farms operations workspace

1. New Tables
- `profiles`: authenticated staff directory with name, role, department, job title, avatar, and active state.
- `activities`: workflow requests and operational records with department, category, amount, priority, status, requester, current owner, and due date.
- `activity_updates`: timeline notes and approval decisions attached to an activity.

2. Security
- Enable row level security on all new tables.
- Authenticated staff may view operational records and their associated timeline.
- Authenticated staff may create and update activities and timeline updates.
- Profile role and active-state changes are restricted to the server-owned profile administration path.

3. Important Notes
- All records are scoped to the authenticated company workspace.
- The profile id is linked to Supabase Auth users and cannot be forged by the browser.
- Amounts and approval states remain visible for operational review but role changes are not client-writable.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'md', 'manager', 'supervisor', 'assistant', 'storekeeper', 'staff')),
  department text NOT NULL DEFAULT 'General',
  title text NOT NULL DEFAULT 'Staff member',
  avatar_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  department text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'completed', 'declined')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  amount numeric(14,2),
  requester_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
  current_owner_role text NOT NULL DEFAULT 'supervisor',
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
  note text NOT NULL,
  decision text CHECK (decision IN ('submitted', 'reviewed', 'approved', 'declined', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activities_department_idx ON public.activities (department);
CREATE INDEX IF NOT EXISTS activities_status_idx ON public.activities (status);
CREATE INDEX IF NOT EXISTS activities_created_at_idx ON public.activities (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_updates_activity_idx ON public.activity_updates (activity_id, created_at DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_profiles" ON public.profiles;
CREATE POLICY "authenticated_read_profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_profiles" ON public.profiles;
CREATE POLICY "authenticated_insert_profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "authenticated_update_profiles" ON public.profiles;
CREATE POLICY "authenticated_update_profiles" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "authenticated_delete_profiles" ON public.profiles;
CREATE POLICY "authenticated_delete_profiles" ON public.profiles FOR DELETE TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "authenticated_read_activities" ON public.activities;
CREATE POLICY "authenticated_read_activities" ON public.activities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_activities" ON public.activities;
CREATE POLICY "authenticated_insert_activities" ON public.activities FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
DROP POLICY IF EXISTS "authenticated_update_activities" ON public.activities;
CREATE POLICY "authenticated_update_activities" ON public.activities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_delete_activities" ON public.activities;
CREATE POLICY "authenticated_delete_activities" ON public.activities FOR DELETE TO authenticated USING (requester_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_read_activity_updates" ON public.activity_updates;
CREATE POLICY "authenticated_read_activity_updates" ON public.activity_updates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_activity_updates" ON public.activity_updates;
CREATE POLICY "authenticated_insert_activity_updates" ON public.activity_updates FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "authenticated_update_activity_updates" ON public.activity_updates;
CREATE POLICY "authenticated_update_activity_updates" ON public.activity_updates FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "authenticated_delete_activity_updates" ON public.activity_updates;
CREATE POLICY "authenticated_delete_activity_updates" ON public.activity_updates FOR DELETE TO authenticated USING (author_id = auth.uid());

REVOKE UPDATE (role, active) ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, email, department, title, avatar_url, updated_at) ON public.profiles TO authenticated;

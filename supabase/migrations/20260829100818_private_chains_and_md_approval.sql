/*
# Private approval chains, MD-only approval, disbursement routing

1. Changes to activities table
- Add `request_type` column: 'funding' | 'store' — determines whether the MD approval routes to Finance/Admin (funding) or Storekeeper (store).
- Add `chain_stage` column: 'supervisor' | 'manager' | 'md' | 'disbursement' | 'done' — the current step in the approval chain. This replaces the use of `current_owner_role` for routing.
- Add `disburser_role` column: 'storekeeper' | 'admin' | null — set by the MD-approval function to record who was notified to disburse.

2. Chain visibility (RLS)
- Replace the open read policies on activities and activity_updates with chain-scoped SELECT policies. An authenticated user may only read an activity if they are the requester, OR their role matches the current chain stage, OR they are the MD (MD sees everything), OR they are the assigned disburser (storekeeper/finance/admin) once the request reaches disbursement.
- Writes to activities and activity_updates are removed from the client entirely — all mutations now go through SECURITY DEFINER functions.

3. New SECURITY DEFINER functions
- `create_activity(p_title, p_description, p_department, p_category, p_priority, p_amount, p_due_date, p_request_type)` — creates an activity owned by auth.uid(), chain_stage = 'supervisor'. Only roles assistant/staff/storekeeper/supervisor/manager can create (field-level staff).
- `advance_activity(p_activity_id, p_decision, p_note)` — moves the chain forward. Validates that the caller's role matches the current chain_stage. Supervisor/manager can 'review' (forward) or 'decline'. MD can 'approve' (routes to disbursement and sets disburser_role) or 'decline'. Disburser can 'complete'. Decline ends the chain at any stage.
- `admin_create_profile(p_email, p_password, p_full_name, p_role, p_department, p_title)` — lets admin/MD create a new auth user + profile in one call (used by the New User modal).

4. Security
- EXECUTE on all new functions revoked from anon, granted to authenticated.
- Direct INSERT/UPDATE on activities and activity_updates revoked from authenticated (all writes through functions).
- Profiles SELECT stays open to authenticated (company directory). Role/active columns remain revoked from direct update.

5. Important notes
- The MD can see every activity in every department at every stage.
- Once the MD approves, only the assigned disburser (storekeeper for store requests, finance/admin for funding requests) plus the requester can see and action the disbursement stage.
- The requester can see their own activity at every stage so they know where it is.
*/

-- Add new columns to activities
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'funding' CHECK (request_type IN ('funding', 'store')),
  ADD COLUMN IF NOT EXISTS chain_stage text NOT NULL DEFAULT 'supervisor' CHECK (chain_stage IN ('supervisor', 'manager', 'md', 'disbursement', 'done')),
  ADD COLUMN IF NOT EXISTS disburser_role text CHECK (disburser_role IN ('storekeeper', 'admin'));

CREATE INDEX IF NOT EXISTS activities_chain_stage_idx ON public.activities (chain_stage);

-- Helper: determine if a user's role matches the current chain stage for an activity
CREATE OR REPLACE FUNCTION public.can_user_see_activity(p_activity public.activities, p_user_role text, p_user_id uuid, p_user_dept text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- MD sees everything
  SELECT
    p_user_role = 'md'
    -- Requester always sees their own request
    OR p_activity.requester_id = p_user_id
    -- Current stage matches the user's role (and for supervisor/manager, same department)
    OR (
      p_activity.chain_stage = 'supervisor' AND p_user_role = 'supervisor'
      AND p_user_dept = p_activity.department
    )
    OR (
      p_activity.chain_stage = 'manager' AND p_user_role = 'manager'
      AND p_user_dept = p_activity.department
    )
    OR (
      p_activity.chain_stage = 'disbursement'
      AND p_user_role = p_activity.disburser_role
    )
    OR (
      p_activity.chain_stage = 'disbursement'
      AND p_user_role = 'storekeeper'
      AND p_activity.disburser_role = 'storekeeper'
      AND p_user_dept = p_activity.department
    )
    -- Once done, requester can still see (covered above) and disburser can see
    OR (
      p_activity.chain_stage = 'done'
      AND p_user_role = p_activity.disburser_role
    );
$$;

-- Replace open read policies with chain-scoped ones
DROP POLICY IF EXISTS "authenticated_read_activities" ON public.activities;
CREATE POLICY "authenticated_read_activities" ON public.activities
  FOR SELECT TO authenticated
  USING (
    public.can_user_see_activity(
      activities,
      (SELECT role FROM public.profiles WHERE id = auth.uid()),
      auth.uid(),
      (SELECT department FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Remove all direct write policies on activities — only functions can write
DROP POLICY IF EXISTS "authenticated_insert_activities" ON public.activities;
DROP POLICY IF EXISTS "authenticated_update_activities" ON public.activities;
DROP POLICY IF EXISTS "authenticated_delete_activities" ON public.activities;

-- Chain-scoped read for activity_updates: same visibility as the parent activity
DROP POLICY IF EXISTS "authenticated_read_activity_updates" ON public.activity_updates;
CREATE POLICY "authenticated_read_activity_updates" ON public.activity_updates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_updates.activity_id
      AND public.can_user_see_activity(
        a,
        (SELECT role FROM public.profiles WHERE id = auth.uid()),
        auth.uid(),
        (SELECT department FROM public.profiles WHERE id = auth.uid())
      )
    )
  );

-- Remove all direct write policies on activity_updates
DROP POLICY IF EXISTS "authenticated_insert_activity_updates" ON public.activity_updates;
DROP POLICY IF EXISTS "authenticated_update_activity_updates" ON public.activity_updates;
DROP POLICY IF EXISTS "authenticated_delete_activity_updates" ON public.activity_updates;

-- Revoke direct table writes entirely
REVOKE INSERT, UPDATE, DELETE ON public.activities FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.activity_updates FROM authenticated;

-- create_activity: field staff create a request, routes to supervisor
CREATE OR REPLACE FUNCTION public.create_activity(
  p_title text,
  p_description text,
  p_department text,
  p_category text,
  p_priority text,
  p_amount numeric,
  p_due_date date,
  p_request_type text
)
RETURNS public.activities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity public.activities;
  v_role text;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
  IF v_role NOT IN ('assistant', 'staff', 'storekeeper', 'supervisor', 'manager') THEN
    RAISE EXCEPTION 'Only field staff can create requests';
  END IF;
  IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid priority';
  END IF;
  IF p_request_type NOT IN ('funding', 'store') THEN
    RAISE EXCEPTION 'Invalid request type';
  END IF;

  INSERT INTO activities (title, description, department, category, status, priority, amount, requester_id, current_owner_role, due_date, request_type, chain_stage)
  VALUES (p_title, p_description, p_department, p_category, 'pending', p_priority, p_amount, auth.uid(), 'supervisor', p_due_date, p_request_type, 'supervisor')
  RETURNING * INTO v_activity;

  INSERT INTO activity_updates (activity_id, author_id, note, decision)
  VALUES (v_activity.id, auth.uid(), 'Submitted this request to the supervisor.', 'submitted');

  RETURN v_activity;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_activity FROM anon;
GRANT EXECUTE ON FUNCTION public.create_activity TO authenticated;

-- advance_activity: move the chain forward with role validation
CREATE OR REPLACE FUNCTION public.advance_activity(
  p_activity_id uuid,
  p_decision text,
  p_note text
)
RETURNS public.activities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity public.activities;
  v_role text;
  v_dept text;
  v_new_stage text;
  v_new_status text;
  v_disburser text;
  v_decision_label text;
BEGIN
  SELECT * INTO v_activity FROM activities WHERE id = p_activity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity not found';
  END IF;

  SELECT role, department INTO v_role, v_dept FROM profiles WHERE id = auth.uid();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF p_decision NOT IN ('reviewed', 'approved', 'declined', 'completed') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  -- Validate caller is authorized for the current stage
  IF v_activity.chain_stage = 'supervisor' THEN
    IF NOT (v_role = 'supervisor' AND v_dept = v_activity.department) AND v_role <> 'md' THEN
      RAISE EXCEPTION 'Only the supervisor of this section can act at this stage';
    END IF;
  ELSIF v_activity.chain_stage = 'manager' THEN
    IF NOT (v_role = 'manager' AND v_dept = v_activity.department) AND v_role <> 'md' THEN
      RAISE EXCEPTION 'Only the manager of this section can act at this stage';
    END IF;
  ELSIF v_activity.chain_stage = 'md' THEN
    IF v_role <> 'md' THEN
      RAISE EXCEPTION 'Only the Managing Director can approve or decline';
    END IF;
  ELSIF v_activity.chain_stage = 'disbursement' THEN
    IF v_role <> v_activity.disburser_role THEN
      IF NOT (v_role = 'storekeeper' AND v_activity.disburser_role = 'storekeeper' AND v_dept = v_activity.department) THEN
        RAISE EXCEPTION 'Only the assigned disburser can complete this request';
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'This request is no longer active';
  END IF;

  -- Stage-specific decision validation
  IF v_activity.chain_stage IN ('supervisor', 'manager') AND p_decision NOT IN ('reviewed', 'declined') THEN
    RAISE EXCEPTION 'At this stage you can only review or decline';
  END IF;
  IF v_activity.chain_stage = 'md' AND p_decision NOT IN ('approved', 'declined') THEN
    RAISE EXCEPTION 'The MD can only approve or decline';
  END IF;
  IF v_activity.chain_stage = 'disbursement' AND p_decision NOT IN ('completed', 'declined') THEN
    RAISE EXCEPTION 'The disburser can only complete or decline';
  END IF;

  -- Compute new stage and status
  IF p_decision = 'declined' THEN
    v_new_stage := 'done';
    v_new_status := 'declined';
    v_decision_label := 'Declined this request.';
  ELSIF p_decision = 'reviewed' THEN
    IF v_activity.chain_stage = 'supervisor' THEN
      v_new_stage := 'manager';
    ELSIF v_activity.chain_stage = 'manager' THEN
      v_new_stage := 'md';
    END IF;
    v_new_status := 'in_review';
    v_decision_label := 'Reviewed and forwarded to the ' || v_new_stage || '.';
  ELSIF p_decision = 'approved' THEN
    -- MD approves: route to disbursement
    v_new_stage := 'disbursement';
    v_new_status := 'approved';
    IF v_activity.request_type = 'funding' THEN
      v_disburser := 'admin';
    ELSE
      v_disburser := 'storekeeper';
    END IF;
    v_decision_label := 'Approved by the MD. Routed to the ' || CASE WHEN v_disburser = 'admin' THEN 'Finance & Admin' ELSE 'Storekeeper' END || ' for disbursement.';
  ELSIF p_decision = 'completed' THEN
    v_new_stage := 'done';
    v_new_status := 'completed';
    v_decision_label := 'Disbursed and completed.';
  END IF;

  -- Update the activity
  UPDATE activities
  SET chain_stage = v_new_stage,
      status = v_new_status,
      disburser_role = COALESCE(v_disburser, activities.disburser_role),
      current_owner_role = CASE
        WHEN v_new_stage = 'manager' THEN 'manager'
        WHEN v_new_stage = 'md' THEN 'md'
        WHEN v_new_stage = 'disbursement' THEN COALESCE(v_disburser, activities.disburser_role)
        WHEN v_new_stage = 'done' THEN activities.current_owner_role
        ELSE activities.current_owner_role
      END,
      updated_at = now()
  WHERE id = p_activity_id
  RETURNING * INTO v_activity;

  -- Record the timeline entry
  INSERT INTO activity_updates (activity_id, author_id, note, decision)
  VALUES (p_activity_id, auth.uid(), COALESCE(NULLIF(p_note, ''), v_decision_label), p_decision);

  RETURN v_activity;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.advance_activity FROM anon;
GRANT EXECUTE ON FUNCTION public.advance_activity TO authenticated;

-- admin_create_profile: admin/MD creates a new user + profile in one call
CREATE OR REPLACE FUNCTION public.admin_create_profile(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_department text,
  p_title text
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_user uuid;
  v_profile public.profiles;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR (v_caller_role <> 'admin' AND v_caller_role <> 'md') THEN
    RAISE EXCEPTION 'Not authorized to create users';
  END IF;
  IF p_role NOT IN ('admin','md','manager','supervisor','assistant','storekeeper','staff') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  IF LENGTH(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  -- Create auth user
  v_user := auth.uid();  -- placeholder, we use the admin API below instead
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, aud, role)
  SELECT
    gen_random_uuid(),
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object('full_name', p_full_name),
    'authenticated',
    'authenticated'
  RETURNING id INTO v_user;

  -- Create profile
  INSERT INTO profiles (id, full_name, email, role, department, title, active)
  VALUES (v_user, p_full_name, p_email, p_role, p_department, COALESCE(NULLIF(p_title, ''), p_role))
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_profile FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_profile TO authenticated;

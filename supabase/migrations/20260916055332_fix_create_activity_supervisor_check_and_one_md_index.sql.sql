/*
# Fix create_activity: only require supervisor for roles that route through one

## Problem
The `create_activity` function unconditionally validates that `p_supervisor_id`
refers to an active supervisor — even when the creator is a supervisor, manager,
or MD who never routes through the supervisor stage. If no active supervisors
exist in the system, EVERY user (including the MD) is blocked from creating
requests.

## Changes
1. `create_activity` — move the supervisor-existence check INSIDE the
   `IF v_role IN ('assistant','staff','storekeeper','admin')` branch so it
   only applies to roles that actually start at the supervisor stage.
   For supervisor/manager/MD creators, `p_supervisor_id` may be NULL and is
   ignored.
2. When the creator is a supervisor/manager/MD, the activity's `department`
   is set from the creator's own profile (since there is no supervisor to
   derive it from).
3. Add a unique partial index `profiles_one_md` on `profiles(role) WHERE
   role = 'md'` to enforce the one-MD invariant at the database level,
   closing the TOCTOU race in `admin_create_profile`.

## Security
- No RLS policy changes.
- `create_activity` remains SECURITY DEFINER with `search_path = 'public'`.
- The unique index prevents a concurrent double-insert of MD accounts.
*/

-- 1. Recreate create_activity with the supervisor check moved inside the role branch
CREATE OR REPLACE FUNCTION public.create_activity(
  p_title text,
  p_description text,
  p_department text,
  p_category text,
  p_priority text,
  p_amount numeric,
  p_due_date date,
  p_request_type text,
  p_supervisor_id uuid
) RETURNS activities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_activity public.activities;
  v_role text;
  v_caller_dept text;
  v_supervisor public.profiles;
  v_initial_stage text;
  v_initial_owner text;
  v_initial_status text;
  v_disburser text;
  v_activity_dept text;
BEGIN
  SELECT role, department INTO v_role, v_caller_dept FROM profiles WHERE id = auth.uid();
  IF v_role IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;

  IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN RAISE EXCEPTION 'Invalid priority'; END IF;
  IF p_request_type NOT IN ('funding', 'store') THEN RAISE EXCEPTION 'Invalid request type'; END IF;

  IF v_role IN ('assistant', 'staff', 'storekeeper', 'admin') THEN
    -- These roles route through a supervisor: validate the supervisor exists and is active
    SELECT * INTO v_supervisor FROM profiles WHERE id = p_supervisor_id AND role = 'supervisor' AND active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Please choose an active supervisor'; END IF;
    v_initial_stage := 'supervisor';
    v_initial_owner := 'supervisor';
    v_initial_status := 'pending';
    v_activity_dept := v_supervisor.department;
  ELSIF v_role = 'supervisor' THEN
    v_initial_stage := 'manager';
    v_initial_owner := 'manager';
    v_initial_status := 'in_review';
    v_activity_dept := v_caller_dept;
  ELSIF v_role = 'manager' THEN
    v_initial_stage := 'md';
    v_initial_owner := 'md';
    v_initial_status := 'in_review';
    v_activity_dept := v_caller_dept;
  ELSIF v_role = 'md' THEN
    v_initial_stage := 'disbursement';
    v_initial_owner := CASE WHEN p_request_type = 'funding' THEN 'admin' ELSE 'storekeeper' END;
    v_initial_status := 'approved';
    v_disburser := v_initial_owner;
    v_activity_dept := v_caller_dept;
  ELSE
    v_initial_stage := 'supervisor';
    v_initial_owner := 'supervisor';
    v_initial_status := 'pending';
    v_activity_dept := v_caller_dept;
  END IF;

  INSERT INTO activities (
    title, description, department, category, status, priority, amount,
    requester_id, current_owner_role, due_date, request_type, chain_stage,
    disburser_role, supervisor_id
  ) VALUES (
    p_title, p_description, v_activity_dept, p_category, v_initial_status,
    p_priority, p_amount, auth.uid(), v_initial_owner, p_due_date, p_request_type,
    v_initial_stage, v_disburser, p_supervisor_id
  ) RETURNING * INTO v_activity;

  -- Record chain participants
  INSERT INTO chain_participants (activity_id, user_id, role_at_stage, stage) VALUES
  (v_activity.id, auth.uid(), v_role, v_initial_stage);

  IF v_role IN ('assistant', 'staff', 'storekeeper', 'admin') THEN
    INSERT INTO chain_participants (activity_id, user_id, role_at_stage, stage) VALUES
    (v_activity.id, p_supervisor_id, 'supervisor', 'supervisor');
  END IF;

  INSERT INTO activity_updates (activity_id, author_id, note, decision)
  VALUES (
    v_activity.id, auth.uid(),
    CASE
      WHEN v_role = 'md' THEN 'Submitted and approved by the MD. Routed for disbursement.'
      WHEN v_role = 'manager' THEN 'Submitted this request. Routed directly to the Managing Director.'
      WHEN v_role = 'supervisor' THEN 'Submitted this request. Routed directly to the Manager.'
      ELSE 'Submitted this request to ' || v_supervisor.full_name || '.'
    END,
    CASE WHEN v_role = 'md' THEN 'approved' ELSE 'submitted' END
  );

  RETURN v_activity;
END;
$function$;

-- 2. Enforce one-MD invariant at the database level (closes the TOCTOU race)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_one_md ON profiles (role) WHERE role = 'md';

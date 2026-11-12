/*
# Route requests to a selected supervisor

1. New column
- `activities.supervisor_id` stores the exact supervisor selected by the requester.
- Existing requests remain valid and continue using department-based visibility when this is null.

2. Request creation
- Adds a secure `create_activity` RPC accepting a supervisor id.
- The server verifies the selected profile is an active supervisor, then derives the request department from that supervisor.
- This prevents users from choosing an unrelated department or unauthorized recipient.

3. Approval security
- Supervisor visibility and supervisor actions require the selected supervisor's profile when `supervisor_id` is set.
- Older requests without an assignment continue using their department's supervisor.

4. Existing data
- Existing requests are assigned automatically when exactly one active supervisor exists for their department.

5. Permissions
- The old create RPC signature is revoked from authenticated and anonymous callers.
- The new RPC is executable only by authenticated users.
*/

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS activities_supervisor_id_idx
  ON public.activities(supervisor_id);

UPDATE public.activities a
SET supervisor_id = s.id
FROM public.profiles s
WHERE a.supervisor_id IS NULL
  AND s.role = 'supervisor'
  AND s.active = true
  AND s.department = a.department
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles another
    WHERE another.role = 'supervisor'
      AND another.active = true
      AND another.department = a.department
      AND another.id <> s.id
  );

REVOKE EXECUTE ON FUNCTION public.create_activity(text, text, text, text, text, numeric, date, text) FROM anon, authenticated;

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
)
RETURNS public.activities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity public.activities;
  v_role text;
  v_supervisor public.profiles;
  v_initial_stage text;
  v_initial_owner text;
  v_initial_status text;
  v_disburser text;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;

  SELECT * INTO v_supervisor
  FROM profiles
  WHERE id = p_supervisor_id AND role = 'supervisor' AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Please choose an active supervisor'; END IF;

  IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN RAISE EXCEPTION 'Invalid priority'; END IF;
  IF p_request_type NOT IN ('funding', 'store') THEN RAISE EXCEPTION 'Invalid request type'; END IF;

  IF v_role IN ('assistant', 'staff', 'storekeeper', 'admin') THEN
    v_initial_stage := 'supervisor'; v_initial_owner := 'supervisor'; v_initial_status := 'pending';
  ELSIF v_role = 'supervisor' THEN
    v_initial_stage := 'manager'; v_initial_owner := 'manager'; v_initial_status := 'in_review';
  ELSIF v_role = 'manager' THEN
    v_initial_stage := 'md'; v_initial_owner := 'md'; v_initial_status := 'in_review';
  ELSIF v_role = 'md' THEN
    v_initial_stage := 'disbursement';
    v_initial_owner := CASE WHEN p_request_type = 'funding' THEN 'admin' ELSE 'storekeeper' END;
    v_initial_status := 'approved';
    v_disburser := v_initial_owner;
  ELSE
    v_initial_stage := 'supervisor'; v_initial_owner := 'supervisor'; v_initial_status := 'pending';
  END IF;

  INSERT INTO activities (
    title, description, department, category, status, priority, amount,
    requester_id, current_owner_role, due_date, request_type, chain_stage,
    disburser_role, supervisor_id
  )
  VALUES (
    p_title, p_description, v_supervisor.department, p_category, v_initial_status,
    p_priority, p_amount, auth.uid(), v_initial_owner, p_due_date, p_request_type,
    v_initial_stage, v_disburser, p_supervisor_id
  )
  RETURNING * INTO v_activity;

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
$$;

REVOKE EXECUTE ON FUNCTION public.create_activity(text, text, text, text, text, numeric, date, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_activity(text, text, text, text, text, numeric, date, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_user_see_activity(
  p_activity public.activities,
  p_user_role text,
  p_user_id uuid,
  p_user_dept text
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
SELECT
  p_user_role = 'md'
  OR p_activity.requester_id = p_user_id
  OR (
    p_activity.chain_stage = 'supervisor'
    AND p_user_role = 'supervisor'
    AND (
      (p_activity.supervisor_id IS NOT NULL AND p_activity.supervisor_id = p_user_id)
      OR (p_activity.supervisor_id IS NULL AND p_user_dept = p_activity.department)
    )
  )
  OR (p_activity.chain_stage = 'manager' AND p_user_role = 'manager' AND p_user_dept = p_activity.department)
  OR (p_activity.chain_stage = 'disbursement' AND p_user_role = p_activity.disburser_role)
  OR (
    p_activity.chain_stage = 'disbursement'
    AND p_user_role = 'storekeeper'
    AND p_activity.disburser_role = 'storekeeper'
    AND p_user_dept = p_activity.department
  )
  OR (p_activity.chain_stage = 'done' AND p_user_role = p_activity.disburser_role);
$$;

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
  IF NOT FOUND THEN RAISE EXCEPTION 'Activity not found'; END IF;
  SELECT role, department INTO v_role, v_dept FROM profiles WHERE id = auth.uid();
  IF v_role IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF p_decision NOT IN ('reviewed', 'approved', 'declined', 'completed') THEN RAISE EXCEPTION 'Invalid decision'; END IF;

  IF v_activity.chain_stage = 'supervisor' THEN
    IF NOT (
      v_role = 'supervisor'
      AND ((v_activity.supervisor_id IS NOT NULL AND v_activity.supervisor_id = auth.uid()) OR (v_activity.supervisor_id IS NULL AND v_dept = v_activity.department))
    ) AND v_role <> 'md' THEN
      RAISE EXCEPTION 'Only the assigned supervisor can act at this stage';
    END IF;
  ELSIF v_activity.chain_stage = 'manager' THEN
    IF NOT (v_role = 'manager' AND v_dept = v_activity.department) AND v_role <> 'md' THEN RAISE EXCEPTION 'Only the manager of this section can act at this stage'; END IF;
  ELSIF v_activity.chain_stage = 'md' THEN
    IF v_role <> 'md' THEN RAISE EXCEPTION 'Only the Managing Director can approve or decline'; END IF;
  ELSIF v_activity.chain_stage = 'disbursement' THEN
    IF v_role <> v_activity.disburser_role AND NOT (v_role = 'storekeeper' AND v_activity.disburser_role = 'storekeeper' AND v_dept = v_activity.department) THEN RAISE EXCEPTION 'Only the assigned disburser can complete this request'; END IF;
  ELSE RAISE EXCEPTION 'This request is no longer active'; END IF;

  IF v_activity.chain_stage IN ('supervisor', 'manager') AND p_decision NOT IN ('reviewed', 'declined') THEN RAISE EXCEPTION 'At this stage you can only review or decline'; END IF;
  IF v_activity.chain_stage = 'md' AND p_decision NOT IN ('approved', 'declined') THEN RAISE EXCEPTION 'The MD can only approve or decline'; END IF;
  IF v_activity.chain_stage = 'disbursement' AND p_decision NOT IN ('completed', 'declined') THEN RAISE EXCEPTION 'The disburser can only complete or decline'; END IF;

  IF p_decision = 'declined' THEN
    v_new_stage := 'done'; v_new_status := 'declined'; v_decision_label := 'Declined this request.';
  ELSIF p_decision = 'reviewed' THEN
    v_new_stage := CASE WHEN v_activity.chain_stage = 'supervisor' THEN 'manager' ELSE 'md' END;
    v_new_status := 'in_review'; v_decision_label := 'Reviewed and forwarded to the ' || v_new_stage || '.';
  ELSIF p_decision = 'approved' THEN
    v_new_stage := 'disbursement'; v_new_status := 'approved';
    v_disburser := CASE WHEN v_activity.request_type = 'funding' THEN 'admin' ELSE 'storekeeper' END;
    v_decision_label := 'Approved by the MD. Routed for disbursement.';
  ELSE
    v_new_stage := 'done'; v_new_status := 'completed'; v_decision_label := 'Disbursed and completed.';
  END IF;

  UPDATE activities
  SET chain_stage = v_new_stage,
      status = v_new_status,
      disburser_role = COALESCE(v_disburser, activities.disburser_role),
      current_owner_role = CASE
        WHEN v_new_stage = 'manager' THEN 'manager'
        WHEN v_new_stage = 'md' THEN 'md'
        WHEN v_new_stage = 'disbursement' THEN COALESCE(v_disburser, activities.disburser_role)
        ELSE activities.current_owner_role
      END,
      updated_at = now()
  WHERE id = p_activity_id
  RETURNING * INTO v_activity;

  INSERT INTO activity_updates (activity_id, author_id, note, decision)
  VALUES (p_activity_id, auth.uid(), COALESCE(NULLIF(p_note, ''), v_decision_label), p_decision);
  RETURN v_activity;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.advance_activity(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.advance_activity(uuid, text, text) TO authenticated;

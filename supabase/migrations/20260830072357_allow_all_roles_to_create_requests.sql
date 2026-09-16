/*
# Allow all roles to create requests, with chain starting at the right stage

1. Changes to create_activity function
- Removes the role restriction that blocked admin and md from creating requests.
- Sets the initial chain_stage based on the creator's role:
  - assistant/staff/storekeeper → starts at 'supervisor'
  - supervisor → starts at 'manager' (skips their own review stage)
  - manager → starts at 'md' (skips supervisor and their own review)
  - md → starts at 'disbursement' with the MD as having already approved (self-approve, routes to storekeeper or admin)
  - admin → starts at 'supervisor' (admin is the finance office, requests go through the normal chain)
- Adds an automatic approval timeline entry when MD creates a request (self-approved).

2. Security
- No changes to EXECUTE grants. Function remains SECURITY DEFINER, EXECUTE granted to authenticated only.
*/

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
  v_dept text;
  v_initial_stage text;
  v_initial_owner text;
  v_initial_status text;
  v_disburser text;
BEGIN
  SELECT role, department INTO v_role, v_dept FROM profiles WHERE id = auth.uid();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
  IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid priority';
  END IF;
  IF p_request_type NOT IN ('funding', 'store') THEN
    RAISE EXCEPTION 'Invalid request type';
  END IF;

  -- Determine starting chain stage based on creator's role
  IF v_role IN ('assistant', 'staff', 'storekeeper', 'admin') THEN
    v_initial_stage := 'supervisor';
    v_initial_owner := 'supervisor';
    v_initial_status := 'pending';
  ELSIF v_role = 'supervisor' THEN
    v_initial_stage := 'manager';
    v_initial_owner := 'manager';
    v_initial_status := 'in_review';
  ELSIF v_role = 'manager' THEN
    v_initial_stage := 'md';
    v_initial_owner := 'md';
    v_initial_status := 'in_review';
  ELSIF v_role = 'md' THEN
    -- MD creates and self-approves, routes directly to disbursement
    v_initial_stage := 'disbursement';
    v_initial_owner := CASE WHEN p_request_type = 'funding' THEN 'admin' ELSE 'storekeeper' END;
    v_initial_status := 'approved';
    v_disburser := CASE WHEN p_request_type = 'funding' THEN 'admin' ELSE 'storekeeper' END;
  ELSE
    v_initial_stage := 'supervisor';
    v_initial_owner := 'supervisor';
    v_initial_status := 'pending';
  END IF;

  INSERT INTO activities (title, description, department, category, status, priority, amount, requester_id, current_owner_role, due_date, request_type, chain_stage, disburser_role)
  VALUES (p_title, p_description, p_department, p_category, v_initial_status, p_priority, p_amount, auth.uid(), v_initial_owner, p_due_date, p_request_type, v_initial_stage, v_disburser)
  RETURNING * INTO v_activity;

  -- Record submission
  INSERT INTO activity_updates (activity_id, author_id, note, decision)
  VALUES (v_activity.id, auth.uid(),
    CASE
      WHEN v_role = 'md' THEN 'Submitted and approved by the MD. Routed to ' || CASE WHEN v_disburser = 'admin' THEN 'Finance & Admin' ELSE 'Storekeeper' END || ' for disbursement.'
      WHEN v_role = 'manager' THEN 'Submitted this request. Routed directly to the Managing Director.'
      WHEN v_role = 'supervisor' THEN 'Submitted this request. Routed directly to the Manager.'
      ELSE 'Submitted this request to the supervisor.'
    END,
    CASE WHEN v_role = 'md' THEN 'approved' ELSE 'submitted' END
  );

  RETURN v_activity;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_activity FROM anon;
GRANT EXECUTE ON FUNCTION public.create_activity TO authenticated;

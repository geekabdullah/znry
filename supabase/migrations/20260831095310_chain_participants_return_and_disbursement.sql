/*
# Chain participants, return-for-clarification, and disbursement recording

1. New table
- `chain_participants`: records every person who has been part of a request's chain.
- Columns: activity_id, user_id, role_at_stage, stage, joined_at.
- RLS: SELECT only for participants who are in the chain (via can_user_see_activity).

2. Visibility changes
- `can_user_see_activity` now also grants access to anyone listed in `chain_participants` for that activity.
- This means: once a supervisor forwards a request, they still see it. Once a manager forwards it, they still see it. The creator always sees it.

3. Return for clarification
- `advance_activity` now accepts decision 'returned' — sends the request back one stage.
- MD can return to manager, manager can return to supervisor, supervisor can return to requester (requester gets it back as a draft-like state).
- When returned to requester, chain_stage = 'supervisor' and status = 'pending' again, so it can be resubmitted.

4. Disbursement details
- New columns on activities: payment_ref, amount_released, stock_item, stock_qty_released, disbursed_at.
- `advance_activity` with decision 'completed' now accepts optional disbursement fields.
- These are recorded when the storekeeper or finance admin completes the disbursement.

5. Chain participants population
- `advance_activity` inserts a chain_participants row for the actor at each stage transition.
- `create_activity` inserts the requester and (if applicable) the initial supervisor as participants.

6. Security
- All writes go through SECURITY DEFINER functions. RLS on chain_participants is SELECT-only via can_user_see_activity.
- Existing activities get backfilled chain_participants rows from their activity_updates.
*/

-- 1. Chain participants table
CREATE TABLE IF NOT EXISTS public.chain_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_at_stage text NOT NULL,
  stage text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chain_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_chain_participants" ON public.chain_participants;
CREATE POLICY "read_chain_participants"
ON public.chain_participants FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM activities a
    WHERE a.id = chain_participants.activity_id
    AND can_user_see_activity(
      a.*,
      (SELECT role FROM profiles WHERE id = auth.uid()),
      auth.uid(),
      (SELECT department FROM profiles WHERE id = auth.uid())
    )
  )
);

CREATE INDEX IF NOT EXISTS chain_participants_activity_idx ON public.chain_participants(activity_id);
CREATE INDEX IF NOT EXISTS chain_participants_user_idx ON public.chain_participants(user_id);

-- 2. Disbursement detail columns
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS payment_ref text,
  ADD COLUMN IF NOT EXISTS amount_released numeric,
  ADD COLUMN IF NOT EXISTS stock_item text,
  ADD COLUMN IF NOT EXISTS stock_qty_released numeric,
  ADD COLUMN IF NOT EXISTS disbursed_at timestamptz;

-- 3. Updated visibility function — chain participants retain access
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
  -- MD sees everything
  p_user_role = 'md'
  -- Creator always sees their own request
  OR p_activity.requester_id = p_user_id
  -- Current stage holder sees it
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
  -- Past chain participants retain access
  OR EXISTS (
    SELECT 1 FROM chain_participants cp
    WHERE cp.activity_id = p_activity.id AND cp.user_id = p_user_id
  );
$$;

-- 4. Backfill chain_participants from existing activity_updates
INSERT INTO public.chain_participants (activity_id, user_id, role_at_stage, stage, joined_at)
SELECT DISTINCT ON (a.id, u.author_id)
  a.id, u.author_id,
  COALESCE(p.role, 'staff'),
  COALESCE(a.chain_stage, 'supervisor'),
  u.created_at
FROM public.activity_updates u
JOIN public.activities a ON a.id = u.activity_id
LEFT JOIN public.profiles p ON p.id = u.author_id
WHERE NOT EXISTS (
  SELECT 1 FROM chain_participants cp
  WHERE cp.activity_id = a.id AND cp.user_id = u.author_id
)
ORDER BY a.id, u.author_id, u.created_at;

-- Also add requester as participant for existing activities
INSERT INTO public.chain_participants (activity_id, user_id, role_at_stage, stage)
SELECT a.id, a.requester_id, 'requester', 'supervisor'
FROM public.activities a
WHERE NOT EXISTS (
  SELECT 1 FROM chain_participants cp
  WHERE cp.activity_id = a.id AND cp.user_id = a.requester_id
);

-- 5. Updated create_activity — records chain participants
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

  SELECT * INTO v_supervisor FROM profiles WHERE id = p_supervisor_id AND role = 'supervisor' AND active = true;
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
$$;

REVOKE EXECUTE ON FUNCTION public.create_activity(text, text, text, text, text, numeric, date, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_activity(text, text, text, text, text, numeric, date, text, uuid) TO authenticated;

-- 6. Updated advance_activity — return-for-clarification + disbursement recording + participant tracking
CREATE OR REPLACE FUNCTION public.advance_activity(
  p_activity_id uuid,
  p_decision text,
  p_note text,
  p_payment_ref text DEFAULT NULL,
  p_amount_released numeric DEFAULT NULL,
  p_stock_item text DEFAULT NULL,
  p_stock_qty numeric DEFAULT NULL
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

  IF p_decision NOT IN ('reviewed', 'approved', 'declined', 'returned', 'completed') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  -- Stage authorization
  IF v_activity.chain_stage = 'supervisor' THEN
    IF NOT (
      v_role = 'supervisor'
      AND ((v_activity.supervisor_id IS NOT NULL AND v_activity.supervisor_id = auth.uid()) OR (v_activity.supervisor_id IS NULL AND v_dept = v_activity.department))
    ) AND v_role <> 'md' THEN
      RAISE EXCEPTION 'Only the assigned supervisor can act at this stage';
    END IF;
  ELSIF v_activity.chain_stage = 'manager' THEN
    IF NOT (v_role = 'manager' AND v_dept = v_activity.department) AND v_role <> 'md' THEN
      RAISE EXCEPTION 'Only the manager of this section can act at this stage';
    END IF;
  ELSIF v_activity.chain_stage = 'md' THEN
    IF v_role <> 'md' THEN RAISE EXCEPTION 'Only the Managing Director can approve or decline'; END IF;
  ELSIF v_activity.chain_stage = 'disbursement' THEN
    IF v_role <> v_activity.disburser_role AND NOT (v_role = 'storekeeper' AND v_activity.disburser_role = 'storekeeper' AND v_dept = v_activity.department) THEN
      RAISE EXCEPTION 'Only the assigned disburser can complete this request';
    END IF;
  ELSE
    RAISE EXCEPTION 'This request is no longer active';
  END IF;

  -- Decision validation per stage
  IF v_activity.chain_stage IN ('supervisor', 'manager') AND p_decision NOT IN ('reviewed', 'declined', 'returned') THEN
    RAISE EXCEPTION 'At this stage you can only review, return, or decline';
  END IF;
  IF v_activity.chain_stage = 'md' AND p_decision NOT IN ('approved', 'declined', 'returned') THEN
    RAISE EXCEPTION 'The MD can only approve, return, or decline';
  END IF;
  IF v_activity.chain_stage = 'disbursement' AND p_decision NOT IN ('completed', 'declined') THEN
    RAISE EXCEPTION 'The disburser can only complete or decline';
  END IF;

  -- Record actor as chain participant
  INSERT INTO chain_participants (activity_id, user_id, role_at_stage, stage)
  VALUES (p_activity_id, auth.uid(), v_role, v_activity.chain_stage);

  -- Compute new stage and status
  IF p_decision = 'declined' THEN
    v_new_stage := 'done'; v_new_status := 'declined'; v_decision_label := 'Declined this request.';
  ELSIF p_decision = 'returned' THEN
    -- Return one stage back
    IF v_activity.chain_stage = 'md' THEN
      v_new_stage := 'manager'; v_new_status := 'in_review';
      v_decision_label := 'Returned to the Manager for clarification.';
    ELSIF v_activity.chain_stage = 'manager' THEN
      v_new_stage := 'supervisor'; v_new_status := 'pending';
      v_decision_label := 'Returned to the Supervisor for clarification.';
    ELSIF v_activity.chain_stage = 'supervisor' THEN
      v_new_stage := 'supervisor'; v_new_status := 'pending';
      v_decision_label := 'Returned to the requester for clarification. The request is back at the supervisor stage.';
    END IF;
  ELSIF p_decision = 'reviewed' THEN
    v_new_stage := CASE WHEN v_activity.chain_stage = 'supervisor' THEN 'manager' ELSE 'md' END;
    v_new_status := 'in_review';
    v_decision_label := 'Reviewed and forwarded to the ' || v_new_stage || '.';
  ELSIF p_decision = 'approved' THEN
    v_new_stage := 'disbursement'; v_new_status := 'approved';
    v_disburser := CASE WHEN v_activity.request_type = 'funding' THEN 'admin' ELSE 'storekeeper' END;
    v_decision_label := 'Approved by the MD. Routed for disbursement.';
  ELSIF p_decision = 'completed' THEN
    v_new_stage := 'done'; v_new_status := 'completed';
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
        ELSE activities.current_owner_role
      END,
      payment_ref = COALESCE(p_payment_ref, activities.payment_ref),
      amount_released = COALESCE(p_amount_released, activities.amount_released),
      stock_item = COALESCE(p_stock_item, activities.stock_item),
      stock_qty_released = COALESCE(p_stock_qty, activities.stock_qty_released),
      disbursed_at = CASE WHEN p_decision = 'completed' THEN now() ELSE activities.disbursed_at END,
      updated_at = now()
  WHERE id = p_activity_id
  RETURNING * INTO v_activity;

  INSERT INTO activity_updates (activity_id, author_id, note, decision)
  VALUES (p_activity_id, auth.uid(), COALESCE(NULLIF(p_note, ''), v_decision_label), p_decision);

  RETURN v_activity;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.advance_activity(uuid, text, text, text, numeric, text, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.advance_activity(uuid, text, text, text, numeric, text, numeric) TO authenticated;

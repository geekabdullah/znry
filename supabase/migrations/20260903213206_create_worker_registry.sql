/*
# Create worker registry table

1. New Tables
- `workers`: a standalone registry of company workers with manually-entered
  names, phone numbers, rank, department, and additional info. This is separate
  from `profiles` (which are login accounts) — workers are records the admin
  enters manually for documentation and PDF export purposes.
  - `id` (uuid, primary key)
  - `full_name` (text, not null) — worker's full name
  - `phone` (text) — phone number
  - `rank` (text) — job rank / position title
  - `department` (text) — department the worker belongs to
  - `info` (text) — additional free-text info (address, next of kin, etc.)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Security
- Enable RLS on `workers`.
- All authenticated users can read the worker registry (it's company-wide reference data).
- Only admin and MD roles can insert, update, and delete workers, enforced via
  SECURITY DEFINER functions that check the caller's role.
- EXECUTE on admin functions is revoked from anon and granted to authenticated.

3. Functions
- `admin_create_worker`: creates a new worker row (admin/md only).
- `admin_update_worker`: updates an existing worker row (admin/md only).
- `admin_delete_worker`: deletes a worker row (admin/md only).
*/

CREATE TABLE IF NOT EXISTS public.workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  rank text NOT NULL DEFAULT '',
  department text NOT NULL DEFAULT '',
  info text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workers_department_idx ON public.workers (department);
CREATE INDEX IF NOT EXISTS workers_created_at_idx ON public.workers (created_at DESC);

ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_workers" ON public.workers;
CREATE POLICY "authenticated_read_workers" ON public.workers
  FOR SELECT TO authenticated USING (true);

-- Write operations are handled through SECURITY DEFINER functions below,
-- so we do not grant direct INSERT/UPDATE/DELETE to authenticated.
-- The policies exist only to satisfy RLS; actual access control is in the functions.

DROP POLICY IF EXISTS "admin_insert_workers" ON public.workers;
CREATE POLICY "admin_insert_workers" ON public.workers
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_workers" ON public.workers;
CREATE POLICY "admin_update_workers" ON public.workers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_workers" ON public.workers;
CREATE POLICY "admin_delete_workers" ON public.workers
  FOR DELETE TO authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.workers FROM authenticated;
GRANT SELECT ON public.workers TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_worker(
  p_full_name text,
  p_phone text,
  p_rank text,
  p_department text,
  p_info text
) RETURNS public.workers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_row public.workers;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR (v_caller_role <> 'admin' AND v_caller_role <> 'md') THEN
    RAISE EXCEPTION 'Not authorized to manage workers';
  END IF;

  INSERT INTO public.workers (full_name, phone, rank, department, info)
  VALUES (p_full_name, p_phone, p_rank, p_department, p_info)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_worker FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_worker TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_worker(
  p_worker_id uuid,
  p_full_name text,
  p_phone text,
  p_rank text,
  p_department text,
  p_info text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR (v_caller_role <> 'admin' AND v_caller_role <> 'md') THEN
    RAISE EXCEPTION 'Not authorized to manage workers';
  END IF;

  UPDATE public.workers
  SET full_name = p_full_name,
      phone = p_phone,
      rank = p_rank,
      department = p_department,
      info = p_info,
      updated_at = now()
  WHERE id = p_worker_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_worker FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_worker TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_worker(
  p_worker_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR (v_caller_role <> 'admin' AND v_caller_role <> 'md') THEN
    RAISE EXCEPTION 'Not authorized to manage workers';
  END IF;

  DELETE FROM public.workers WHERE id = p_worker_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_worker FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_worker TO authenticated;

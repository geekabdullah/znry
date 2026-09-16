/*
# Bootstrap first admin account

1. New function
- `bootstrap_first_admin(p_full_name text)`: called by an authenticated user who has NO profile yet. If there are zero existing profiles, creates a profile for auth.uid() with role='admin', department='Finance & Admin'. If any profiles already exist, raises an error (only the very first user can self-bootstrap).

2. Security
- SECURITY DEFINER so it can write the role column (which is revoked from direct update).
- EXECUTE revoked from anon, granted to authenticated.
- The function checks that no profiles exist yet, so it can only be used once for the initial setup.
*/

CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(p_full_name text)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_email text;
  v_profile public.profiles;
BEGIN
  SELECT COUNT(*) INTO v_count FROM profiles;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'The workspace is already set up. Ask the Finance & Admin to create your account.';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Auth user not found';
  END IF;

  INSERT INTO profiles (id, full_name, email, role, department, title, active)
  VALUES (auth.uid(), p_full_name, v_email, 'admin', 'Finance & Admin', 'Finance & Admin', true)
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin FROM anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin TO authenticated;

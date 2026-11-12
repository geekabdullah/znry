/*
# Allow admin to create exactly one MD account

1. Changes
- Modifies `admin_create_profile` to allow creating an account with role 'md',
  but ONLY if no existing profile has role='md'. This means the admin can create
  the company owner's MD account exactly once. After that, the MD role is blocked.
- The 'admin' role remains permanently blocked from creation through the app.
  The initial admin is set up exclusively through `bootstrap_first_admin`.

2. Security
- admin_create_profile remains SECURITY DEFINER, EXECUTE granted to authenticated only.
- The role check now allows 'md' (with a one-time guard) and all non-admin roles.
- 'admin' is always rejected with a clear message.
*/

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
  v_md_count int;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR (v_caller_role <> 'admin' AND v_caller_role <> 'md') THEN
    RAISE EXCEPTION 'Not authorized to create users';
  END IF;
  IF p_role = 'admin' THEN
    RAISE EXCEPTION 'Admin accounts cannot be created through the app. The first admin is set up during initial bootstrap only.';
  END IF;
  IF p_role = 'md' THEN
    SELECT COUNT(*) INTO v_md_count FROM profiles WHERE role = 'md';
    IF v_md_count > 0 THEN
      RAISE EXCEPTION 'An MD account already exists. Only one MD can be created.';
    END IF;
  END IF;
  IF p_role NOT IN ('md','manager','supervisor','assistant','storekeeper','staff') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  IF LENGTH(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  -- Create auth user
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

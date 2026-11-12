/*
# Lock down admin and MD account creation

1. Changes
- Modifies `admin_create_profile` to refuse creating accounts with role 'admin' or 'md'.
  Only non-admin roles (manager, supervisor, assistant, storekeeper, staff) can be created
  through this function. The initial admin is set up exclusively through `bootstrap_first_admin`,
  which only works when zero profiles exist — so there is exactly one way to get the first admin,
  and it can only happen once. After that, no one — not even the admin — can create another
  admin or MD account through the application.

2. Security
- admin_create_profile remains SECURITY DEFINER, EXECUTE granted to authenticated only.
- The role check now rejects 'admin' and 'md' with a clear error message.
- bootstrap_first_admin is unchanged (already locked to zero-profile state).
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
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR (v_caller_role <> 'admin' AND v_caller_role <> 'md') THEN
    RAISE EXCEPTION 'Not authorized to create users';
  END IF;
  IF p_role NOT IN ('manager','supervisor','assistant','storekeeper','staff') THEN
    RAISE EXCEPTION 'Admin and MD accounts cannot be created through the app. The first admin is set up during initial bootstrap only.';
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

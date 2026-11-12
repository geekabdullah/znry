-- Fix: use bcrypt cost 10 in admin_create_profile (Supabase auth expects cost 10)
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

  -- Create auth user with bcrypt cost 10 (required by Supabase GoTrue)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change_token_new, email_change
  )
  SELECT
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_full_name),
    now(),
    now(),
    '', '', ''
  RETURNING id INTO v_user;

  -- Create identity row (required for login)
  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
  SELECT gen_random_uuid(), v_user, p_email, 'email',
    jsonb_build_object('sub', v_user::text, 'email', p_email, 'email_verified', true),
    now(), now();

  -- Create profile
  INSERT INTO profiles (id, full_name, email, role, department, title, active)
  VALUES (v_user, p_full_name, p_email, p_role, p_department, COALESCE(NULLIF(p_title, ''), p_role))
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_profile FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_profile TO authenticated;

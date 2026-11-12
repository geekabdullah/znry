/*
# Fix admin_create_profile: pgcrypto functions not found in search_path

1. Root Cause
- pgcrypto is installed in the `extensions` schema.
- The function sets `search_path = public`, so `gen_salt()` and `crypt()` 
  from pgcrypto are NOT visible inside the function.
- This caused EVERY call to admin_create_profile to fail with 
  "function gen_salt(unknown, integer) does not exist".
- This is why no members could be created — not just MD.

2. Fix
- Schema-qualify the pgcrypto calls as `extensions.gen_salt()` and `extensions.crypt()`.
- This works regardless of the function's search_path setting.

3. Security Hardening (also fixes advisor warnings)
- Revoke EXECUTE from PUBLIC and anon so only authenticated users can call it.
- The function already checks auth.uid() internally, but defense-in-depth matters.
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

  -- Create auth user with bcrypt cost 10 (required by Supabase GoTrue)
  -- pgcrypto lives in the `extensions` schema, so we schema-qualify the calls
  BEGIN
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
      lower(p_email),
      extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', p_full_name),
      now(),
      now(),
      '', '', ''
    RETURNING id INTO v_user;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Could not create auth user: %', SQLERRM;
  END;

  -- Create identity row (required for login)
  BEGIN
    INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, email, created_at, updated_at)
    SELECT gen_random_uuid(), v_user, v_user::text, 'email',
      jsonb_build_object('sub', v_user::text, 'email', lower(p_email), 'email_verified', true),
      lower(p_email),
      now(), now();
  EXCEPTION WHEN OTHERS THEN
    DELETE FROM auth.users WHERE id = v_user;
    RAISE EXCEPTION 'Could not create identity: %', SQLERRM;
  END;

  -- Create profile
  BEGIN
    INSERT INTO profiles (id, full_name, email, role, department, title, active)
    VALUES (v_user, p_full_name, lower(p_email), p_role, p_department, COALESCE(NULLIF(p_title, ''), p_role), true)
    RETURNING * INTO v_profile;
  EXCEPTION WHEN OTHERS THEN
    DELETE FROM auth.identities WHERE user_id = v_user;
    DELETE FROM auth.users WHERE id = v_user;
    RAISE EXCEPTION 'Could not create profile: %', SQLERRM;
  END;

  RETURN v_profile;
END;
$$;

-- Hardening: remove PUBLIC and anon EXECUTE access
REVOKE EXECUTE ON FUNCTION public.admin_create_profile FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_create_profile FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_profile TO authenticated;

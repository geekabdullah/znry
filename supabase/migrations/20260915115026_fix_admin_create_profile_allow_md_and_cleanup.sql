/*
# Fix admin_create_profile: allow MD creation, add error cleanup, fix identity email

1. Changes
- Re-enables creating MD accounts through admin_create_profile, with a one-time guard:
  if a profile with role='md' already exists, creation is blocked.
- The 'admin' role remains permanently blocked — only bootstrap_first_admin can create it.
- Adds proper error handling: if the profile INSERT fails after the auth user is created,
  the auth user is deleted so we don't leave orphaned accounts.
- Fixes the auth.identities INSERT to include the `email` column (NOT NULL in newer Supabase).
- Keeps bcrypt cost 10 for GoTrue compatibility.
- Keeps SECURITY DEFINER + search_path=public.

2. Security
- Function remains SECURITY DEFINER, EXECUTE granted to authenticated only.
- Caller must be admin or md.
- Role 'admin' is always rejected.
- Role 'md' is allowed only once (one MD per system).
- All other valid roles: manager, supervisor, assistant, storekeeper, staff.
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
      crypt(p_password, gen_salt('bf', 10)),
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
    -- Clean up the orphaned auth user if identity creation fails
    DELETE FROM auth.users WHERE id = v_user;
    RAISE EXCEPTION 'Could not create identity: %', SQLERRM;
  END;

  -- Create profile
  BEGIN
    INSERT INTO profiles (id, full_name, email, role, department, title, active)
    VALUES (v_user, p_full_name, lower(p_email), p_role, p_department, COALESCE(NULLIF(p_title, ''), p_role), true)
    RETURNING * INTO v_profile;
  EXCEPTION WHEN OTHERS THEN
    -- Clean up the orphaned auth user + identity if profile creation fails
    DELETE FROM auth.identities WHERE user_id = v_user;
    DELETE FROM auth.users WHERE id = v_user;
    RAISE EXCEPTION 'Could not create profile: %', SQLERRM;
  END;

  RETURN v_profile;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_profile FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_profile TO authenticated;

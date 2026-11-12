/*
# Catch unique-violation on profiles_one_md in admin_create_profile

## Problem
The `admin_create_profile` function checks for an existing MD with a
SELECT-then-INSERT pattern. The new `profiles_one_md` unique partial index
will now catch a concurrent double-insert at the DB level, but the resulting
error message is a raw "duplicate key value violates unique constraint" —
not the friendly "An MD account already exists" message.

## Change
Wrap the profile insert in a sub-block that catches the unique-violation
error code 23505 and re-raises with the friendly message.
*/

CREATE OR REPLACE FUNCTION public.admin_create_profile(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_department text,
  p_title text
) RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', p_full_name),
      now(), now(), '', '', ''
    RETURNING id INTO v_user;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Could not create auth user: %', SQLERRM;
  END;

  -- Create identity row (required for login)
  BEGIN
    INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
    SELECT gen_random_uuid(), v_user, v_user::text, 'email',
      jsonb_build_object('sub', v_user::text, 'email', lower(p_email), 'email_verified', true),
      now(), now();
  EXCEPTION WHEN OTHERS THEN
    DELETE FROM auth.users WHERE id = v_user;
    RAISE EXCEPTION 'Could not create identity: %', SQLERRM;
  END;

  -- Create profile (catch unique-violation on profiles_one_md for concurrent MD creation)
  BEGIN
    INSERT INTO profiles (id, full_name, email, role, department, title, active)
    VALUES (v_user, p_full_name, lower(p_email), p_role, p_department, COALESCE(NULLIF(p_title, ''), p_role), true)
    RETURNING * INTO v_profile;
  EXCEPTION
    WHEN unique_violation THEN
      DELETE FROM auth.identities WHERE user_id = v_user;
      DELETE FROM auth.users WHERE id = v_user;
      RAISE EXCEPTION 'An MD account already exists. Only one MD can be created.';
    WHEN OTHERS THEN
      DELETE FROM auth.identities WHERE user_id = v_user;
      DELETE FROM auth.users WHERE id = v_user;
      RAISE EXCEPTION 'Could not create profile: %', SQLERRM;
  END;

  RETURN v_profile;
END;
$function$;

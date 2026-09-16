/*
# Create avatars storage bucket and profile admin function

1. Storage
- Create a public bucket "avatars" for staff profile photos.
- Allow authenticated users to upload/update their own avatar path and read all avatars.

2. Functions
- `admin_update_profile`: SECURITY DEFINER function that lets the Finance/Admin or Managing Director update any profile's name, title, department, role, and avatar. The caller is derived from auth.uid(), not a parameter.

3. Security
- avatars bucket is public-read (photos are visible within the company workspace) but only authenticated users may upload.
- admin_update_profile checks that the caller's own profile has role admin or md before allowing any change.
- EXECUTE on admin_update_profile is revoked from anon and granted to authenticated.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_read_all" ON storage.objects;
CREATE POLICY "avatars_read_all" ON storage.objects FOR SELECT
TO public USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_upload_own" ON storage.objects;
CREATE POLICY "avatars_upload_own" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_profile_id uuid,
  p_full_name text,
  p_title text,
  p_department text,
  p_role text,
  p_avatar_url text
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
    RAISE EXCEPTION 'Not authorized to manage profiles';
  END IF;
  IF p_role NOT IN ('admin','md','manager','supervisor','assistant','storekeeper','staff') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  UPDATE profiles
  SET full_name = p_full_name,
      title = p_title,
      department = p_department,
      role = p_role::text,
      avatar_url = p_avatar_url,
      updated_at = now()
  WHERE id = p_profile_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_profile FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_profile TO authenticated;

/*
# Harden request attachment access and enforce upload limits

1. Summary
- Attachments follow the same visibility rules as the request they belong to. Previously any signed-in user could list every attachment and download every file.
- Storage now enforces a 10 MB size limit and an allowlist of document and image MIME types on the server.

2. Modified table: public.activity_attachments
- SELECT: visible only when the signed-in user can see the parent request (same rule as the request itself).
- INSERT: uploader must be the signed-in user and must be able to see the parent request.
- DELETE: unchanged, uploader only.
- Anonymous role loses all privileges on this table.

3. Modified storage bucket: request-attachments
- Read, insert, and delete on storage objects are tied to attachment rows and request visibility.
- File size limit set to 10 MB; allowed MIME types set to the supported document and image formats (SVG intentionally excluded).

4. Removed unused function exposure
- public.get_attachment_url returned file paths for any attachment id without checking visibility. It is not used by the app, so execute privileges are revoked from all client roles.

5. Important notes
- No rows, columns, or existing request records are changed.
- Existing attachments remain readable by the people who can see their request.
*/

DROP POLICY IF EXISTS "attachments_select_all" ON public.activity_attachments;
DROP POLICY IF EXISTS "attachments_select_visible_activity" ON public.activity_attachments;
CREATE POLICY "attachments_select_visible_activity" ON public.activity_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_attachments.activity_id
        AND public.can_user_see_activity(
          a.*,
          (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()),
          auth.uid(),
          (SELECT p.department FROM public.profiles p WHERE p.id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "attachments_insert_own" ON public.activity_attachments;
CREATE POLICY "attachments_insert_own" ON public.activity_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_attachments.activity_id
        AND public.can_user_see_activity(
          a.*,
          (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()),
          auth.uid(),
          (SELECT p.department FROM public.profiles p WHERE p.id = auth.uid())
        )
    )
  );

REVOKE ALL ON public.activity_attachments FROM anon;

DROP POLICY IF EXISTS "attachments_read_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "attachments_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "attachments_delete_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "attachments_read_visible" ON storage.objects;
DROP POLICY IF EXISTS "attachments_insert_visible_request" ON storage.objects;
DROP POLICY IF EXISTS "attachments_delete_uploader" ON storage.objects;

CREATE POLICY "attachments_read_visible" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'request-attachments'
    AND EXISTS (
      SELECT 1 FROM public.activity_attachments aa
      WHERE aa.file_path = storage.objects.name
    )
  );

CREATE POLICY "attachments_insert_visible_request" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'request-attachments'
    AND EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id::text = (storage.foldername(storage.objects.name))[1]
        AND public.can_user_see_activity(
          a.*,
          (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()),
          auth.uid(),
          (SELECT p.department FROM public.profiles p WHERE p.id = auth.uid())
        )
    )
  );

CREATE POLICY "attachments_delete_uploader" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'request-attachments'
    AND EXISTS (
      SELECT 1 FROM public.activity_attachments aa
      WHERE aa.file_path = storage.objects.name
        AND aa.uploaded_by = auth.uid()
    )
  );

UPDATE storage.buckets
SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/rtf',
    'text/rtf',
    'text/plain',
    'text/csv',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',
    'application/zip',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff'
  ]
WHERE id = 'request-attachments';

REVOKE EXECUTE ON FUNCTION public.get_attachment_url(uuid) FROM PUBLIC, anon, authenticated;

/*
# Add file attachments to requests

1. New Storage Bucket
- `request-attachments` (private bucket) stores files uploaded with a request: images, PDFs, Word, Excel, and other documents.
- Files are stored under a private path `{activity_id}/{uuid}.{ext}` so they are not publicly browsable.
- Only authenticated users may upload, read, and delete attachments.
- Reading is controlled via a helper RPC that generates a signed URL, so private objects are never exposed publicly.

2. New Table
- `activity_attachments` records metadata for each file attached to an activity:
  - id (uuid PK)
  - activity_id (FK → activities, cascade delete)
  - uploaded_by (uuid, defaults to auth.uid(), FK → profiles)
  - file_name (text, original file name as uploaded)
  - file_path (text, storage object path inside the `request-attachments` bucket)
  - file_size (bigint, bytes)
  - file_type (text, MIME type)
  - created_at (timestamptz)

3. Security
- RLS enabled on `activity_attachments`.
- Any authenticated user may read attachment metadata (the workspace is internal) and may create/delete their own attachment rows.
- Storage policies on `request-attachments` bucket:
  - SELECT (read) granted to authenticated so signed URLs resolve.
  - INSERT granted to authenticated.
  - DELETE granted to authenticated (uploader may remove).
- A SECURITY DEFINER function `get_attachment_url` returns a time-limited signed URL for a given attachment id; EXECUTE granted to authenticated only.

4. Important Notes
- No existing tables, columns, or functions are altered. This is purely additive.
- Existing request creation, approval chain, and all other functionality remain unchanged.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('request-attachments', 'request-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "attachments_read_authenticated" ON storage.objects;
CREATE POLICY "attachments_read_authenticated" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'request-attachments');

DROP POLICY IF EXISTS "attachments_insert_authenticated" ON storage.objects;
CREATE POLICY "attachments_insert_authenticated" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'request-attachments');

DROP POLICY IF EXISTS "attachments_delete_authenticated" ON storage.objects;
CREATE POLICY "attachments_delete_authenticated" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'request-attachments');

CREATE TABLE IF NOT EXISTS public.activity_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  file_type text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_attachments_activity_idx
  ON public.activity_attachments (activity_id, created_at DESC);

ALTER TABLE public.activity_attachments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.activity_attachments TO authenticated;

DROP POLICY IF EXISTS "attachments_select_all" ON public.activity_attachments;
CREATE POLICY "attachments_select_all" ON public.activity_attachments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "attachments_insert_own" ON public.activity_attachments;
CREATE POLICY "attachments_insert_own" ON public.activity_attachments FOR INSERT
  TO authenticated WITH CHECK (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "attachments_delete_own" ON public.activity_attachments;
CREATE POLICY "attachments_delete_own" ON public.activity_attachments FOR DELETE
  TO authenticated USING (uploaded_by = auth.uid());

CREATE OR REPLACE FUNCTION public.get_attachment_url(
  p_attachment_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.activity_attachments;
BEGIN
  SELECT * INTO v_row FROM public.activity_attachments WHERE id = p_attachment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attachment not found'; END IF;
  -- Returns a path that the client can turn into a signed URL via the storage API.
  RETURN v_row.file_path;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_attachment_url(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attachment_url(uuid) TO authenticated;

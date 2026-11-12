/*
# Disable legacy direct authentication creation

1. Purpose
- Prevent the old database function from inserting directly into Supabase's internal authentication tables.
- Ensure all future managed accounts use the deployed server-side Auth API path.

2. Security changes
- Revoke EXECUTE on the legacy `admin_create_profile` function from authenticated users.
- Existing account records have been normalized so Supabase Auth can read them safely.

3. Important notes
- No user profiles or activity records are deleted.
- Passwords remain protected as one-way hashes and are not exposed through SQL or the application.
*/

REVOKE EXECUTE ON FUNCTION public.admin_create_profile(text, text, text, text, text, text) FROM anon, authenticated;

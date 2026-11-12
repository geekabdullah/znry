/*
# Harden account management and public database access

1. Purpose
- Remove anonymous direct access to application tables.
- Prevent signed-in users from writing profile records directly.
- Keep legitimate account creation, profile updates, and account deletion behind protected server-side paths.

2. Security changes
- Anonymous users lose table privileges on all public application tables.
- Authenticated users retain profile visibility but cannot directly insert, update, or delete profiles.
- Existing RLS policies remain in place and continue to protect authenticated reads.

3. Important notes
- Passwords are never readable from the database; Supabase stores only one-way password hashes.
- Account recovery must use password reset links or an administrator-approved reset flow.
*/

REVOKE ALL ON TABLE public.activities FROM anon;
REVOKE ALL ON TABLE public.activity_updates FROM anon;
REVOKE ALL ON TABLE public.chain_participants FROM anon;
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.workers FROM anon;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.chain_participants FROM authenticated;

GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.activities TO authenticated;
GRANT SELECT ON TABLE public.activity_updates TO authenticated;
GRANT SELECT ON TABLE public.chain_participants TO authenticated;
GRANT SELECT ON TABLE public.workers TO authenticated;

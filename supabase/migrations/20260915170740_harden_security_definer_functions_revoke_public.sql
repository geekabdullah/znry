/*
# Harden SECURITY DEFINER functions: remove PUBLIC execute access

1. Changes
- Revoke EXECUTE from PUBLIC on all admin/privileged SECURITY DEFINER functions.
- These functions already check auth.uid() internally, but PUBLIC access means
  even unauthenticated callers can invoke them (defense-in-depth fix).
- `can_user_see_activity` also gets anon revoked since it's only called from
  RLS policies on authenticated tables.

2. Functions affected
- admin_create_worker, admin_delete_worker, admin_update_worker
- admin_update_profile
- advance_activity
- bootstrap_first_admin
- can_user_see_activity
- create_activity

3. Security
- All functions retain EXECUTE for authenticated role.
- anon and PUBLIC can no longer call these functions directly.
*/

REVOKE EXECUTE ON FUNCTION public.admin_create_worker FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_worker FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_worker FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_profile FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.advance_activity(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.advance_activity(uuid, text, text, text, numeric, text, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_user_see_activity FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_user_see_activity FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_activity(text, text, text, text, text, numeric, date, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_activity(text, text, text, text, text, numeric, date, text, uuid) FROM PUBLIC;

/*
# Normalize existing authentication token fields

1. Purpose
- Repair legacy accounts created by direct SQL inserts into Supabase Auth tables.
- Replace NULL token values with the empty strings expected by the Auth service.

2. Modified data
- `auth.users.confirmation_token`
- `auth.users.recovery_token`
- `auth.users.email_change`
- `auth.users.email_change_token_new`
- `auth.users.email_change_token_current`
- `auth.users.reauthentication_token`
- `auth.users.phone_change`
- `auth.users.phone_change_token`

3. Security notes
- No password values are read or exposed.
- Password hashes are not changed.
- Future accounts use the supported Auth API and do not depend on this repair.
*/

UPDATE auth.users
SET confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change = COALESCE(email_change, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    reauthentication_token = COALESCE(reauthentication_token, ''),
    phone_change = COALESCE(phone_change, ''),
    phone_change_token = COALESCE(phone_change_token, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change IS NULL
   OR email_change_token_new IS NULL
   OR email_change_token_current IS NULL
   OR reauthentication_token IS NULL
   OR phone_change IS NULL
   OR phone_change_token IS NULL;

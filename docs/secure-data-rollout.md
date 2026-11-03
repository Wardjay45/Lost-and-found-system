# Authenticated data access rollout

The API now requires current signed-in sessions in local, public-tunnel and hosted modes. It uses the server-only SUPABASE_SERVICE_ROLE_KEY; there is no anonymous-storage fallback. Web access requires an admin or superadmin account.

The mobile query client retains its existing interface but sends table requests through /api/mobile/data using the signed-in session. The server enforces ownership, safe fields, private conversations and server-derived report identity. It never forwards arbitrary SQL or arbitrary PostgREST operations.

## Database change

Apply server/secure-data-access.sql to the same Supabase project configured by SUPABASE_URL, after deploying the updated API and making the updated mobile connection available. Older APKs that still query private tables anonymously must be updated first. Local application changes do not update an already distributed APK or a hosted API deployment.

The migration deletes no reports or messages. It links legacy conversations only when their account name and conversation are unambiguous; ambiguous histories remain available to administrators. Private tables become service-role-only. Categories and campus locations remain readable reference data, with all writes restricted to the authenticated API.

The migration is repeatable and tested against isolated PostgreSQL. Do not re-run the retired permissive policies from older schema copies.

## Verify

- Anonymous reads of users, reports and messages fail; anonymous category/location writes fail.
- Active admins can read the dashboard; students cannot enter the web workspace.
- Mobile sessions can read their own reports, public active found items and their own conversation.
- Mobile profile edits cannot change account roles, status or other users.
- Only the verified handover endpoint can record a recovery.
- Account, category, location and report mutations record the current actor. If a log fails after the business change succeeds, the response includes X-Activity-Warning and the dashboard displays it.
- Stale sessions fail after a role/status change; superadmin accounts and the caller's own access are protected.

Private mobile database realtime subscriptions no longer receive anonymous record payloads after lockdown. The existing signed-in refresh/polling path remains available; native mobile device validation is still needed.

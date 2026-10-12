---
name: mobile-backend
description: Implement or review data and service behavior used by the Lost & Found mobile app, including Supabase access, Express API routes, authentication, and AI matching, with meaningful functional verification. Use for mobile-facing backend work in this repository; not for visual-only UI changes.
metadata:
  author: "Lost & Found Project"
  version: "1.0.0"
---

# Mobile backend work

Trace the requested user flow before editing. The mobile app uses both direct Supabase calls (`mobile/src/config/supabase.js` and screens or contexts) and the Express API (`mobile/src/config/api.js`, `server/index.js`, and `server/routes/`). Matching requests may also reach `ai-server/main.py`. Check `supabase-schema.sql` and relevant server SQL files before changing fields or status transitions.

1. Follow the data from the mobile action through its actual access path and back to the UI. Confirm which component owns validation, authorization, database writes, error handling, and user feedback. Avoid implementing the same rule differently in direct Supabase access and API routes.
2. Treat client input as untrusted. For data or auth changes, check ownership and role boundaries, status rules, duplicate submissions, and the Supabase policies used by direct mobile access. Do not put a service-role key or other server secret in the mobile bundle or an `EXPO_PUBLIC_` variable.
3. Keep request and response shapes compatible with the mobile caller and admin dashboard. If a schema change is needed, update the migration or schema artifact and affected readers and writers together. Keep environment-specific addresses and credentials out of source changes.
4. Verify the behavior with a focused check that exercises the changed boundary: for example, valid and invalid requests, permission failures, database errors, and a successful response. Use isolated or test data for writes. Run relevant local build or syntax checks as supporting evidence, and state when live Supabase, the AI service, or a device was unavailable.

If work touches authentication, inspect the existing hardcoded `admin123` bypass in both `mobile/src/context/AuthContext.js` and `server/routes/auth.js`; do not extend that behavior. Coordinate a safe migration of existing accounts when replacing it. Do not perform a production migration, credential rotation, deployment, or real-user data change without authorization for that action.

Report the data path changed, checks performed, and any remaining integration risk.
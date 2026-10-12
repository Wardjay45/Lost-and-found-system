---
name: admin-backend
description: Implement or review Lost & Found web admin APIs and shared Supabase workflows, including permissions, item status changes, matching, claim verification, messaging, and settings. Use for admin-facing service and data behavior in this repository; not for visual-only UI changes or mobile-only flows.
---

# Admin backend work

Trace the admin action from its page through `web/src/services/api.js` or its direct `fetch` call to `server/index.js`, the relevant `server/routes/` handler, and `server/db.js`. Matching may also call `ai-server/main.py`. Check both shared API calls and direct calls in `SmartMatching.jsx`, `MatchDetails.jsx`, and `FTFVerificationForm.jsx` when those flows are affected.

## Data contracts and permissions

Read `supabase-schema.sql` and relevant server SQL files before changing queries or writes. Lost items use `date_reported`, found items use `date_found`, and matches use `date_created`; do not assume every table has `created_at`. Verify queried columns and distinguish an empty successful response from a failed request.

Keep request/response shapes compatible with the admin and mobile consumers. Mobile screens can write directly to Supabase, bypassing Express, so check affected mobile readers, writers, and `server/rls-policies.sql` when changing shared fields or behavior. Update schema or migration artifacts together with callers when a schema change is required. Distinguish browser-only preferences in `AppContext.jsx` from values persisted by `/api/settings`.

Treat IDs, roles, ownership, and transition requests as untrusted input. Inspect server authentication and authorization rather than relying on `ProtectedRoute`, hidden buttons, or client-supplied admin names. Check the existing permissive RLS policies where direct access matters; do not assume they enforce ownership. Keep server secrets out of web code and `VITE_` variables.

If authentication is touched, inspect the existing `admin123` bypass and JWT fallback in `server/routes/auth.js`, plus the mobile login path. Do not extend the bypass or silently replace credentials and break existing accounts. Scope any authentication migration explicitly.

## Matching and item release

Follow the affected status change through both item records, stored match data, and activity logs. Verify the actual allowed states and required fields in the handler rather than inventing new transitions. Preserve cancellation reasons and verification details where those actions require them. Failed or repeated requests must not leave the UI reporting success or release an item twice.

For claims, check the lost/found item pair, identity verification, knowledge check, verifier details, and release eligibility at the server boundary. Some admin components recover match relationships from JSON in activity logs; keep those payloads compatible when changing match or log behavior.

For AI changes, trace score units, weighting, ranking, thresholds, and missing embeddings through the Python response, Express route, and admin percentage display. Confirm whether a value is a fraction or a percentage before converting it. Keep AI failure distinct from a valid search with no matches.

## Verification and operational scope

Use focused checks for valid and invalid input, permission failures, database errors, duplicate actions, and successful responses relevant to the change. Use isolated or mocked data for writes. Inspect existing `server/test-*.mjs` and maintenance scripts before running them; their names do not guarantee read-only behavior. Starting `server/index.js` activates a background poller that writes embeddings to Supabase, so inspect its target and side effects before using it for verification.

Keep environment-specific addresses and credentials in existing configuration. Development web requests normally use `/api` through the Vite proxy; `VITE_API_URL` can override the shared client base. Run relevant syntax and functional checks, and web build/lint checks when callers change. Production migrations, deployments, credential rotations, and real-user data changes require authorization for those actions; creating or invoking this skill does not grant it.

Report the data path changed, checks performed, and remaining live Supabase, AI-service, or browser limitations.

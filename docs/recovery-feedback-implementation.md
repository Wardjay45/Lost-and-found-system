# Connected recovery feedback implementation

Approved scope: optional owner feedback after verified handover; separate general feedback; real recovery and satisfaction metrics; unchanged report-volume forecasts. Google-linked school sessions only for student submissions.

## Execution ledger

- Ruling: continue in the user's existing Feature/Skills checkout without a new branch or worktree, because the approved feature depends on extensive uncommitted work already present. Preserve unrelated changes; do not commit.
- Ruling: new recovery records, not existing status flags, establish eligibility. No historical return events or feedback will be manufactured.
- Ruling: server-only, security-invoker database functions provide atomic handover; anonymous clients cannot read or write recovery/feedback tables or invoke handover.
- Ruling: Google sessions gain an authentication-method claim bound to the stored Google subject. Older sessions must reauthenticate; password login and legacy account linking remain unchanged.
- Tasks: database and server; mobile experience; admin review and metrics; verification and independent review.
- Subsequent UI request: show Verified Recovery Performance only on Feedback, not Analytics. Analytics retains its existing report forecasting and charts. Four focused admin tests, production build and lint pass after removing the duplicate section.
- Database/server implemented: eight service/HTTP tests and eight isolated Postgres tests pass, including atomic rollback, anonymous access denial, superadmin compatibility, and an HTTP-to-Postgres end-to-end flow.
- Mobile implemented: draft queue, duplicate-tap protection, optional prompt, persistent actions, Google reauthentication and saved-response view. Seven screen/hook flow tests and three helper tests pass.
- Admin implemented: authenticated handover callers, real feedback list, separate recovery metrics and unchanged report-volume forecast. Production build and lint pass; lint reports existing warnings in unrelated files.
- Ruling: finish the previously approved read-aloud icon replacement because its pending regression test was already failing before this feature. No speech behavior changes.
- Original rollout ruling: live database changes required explicit approval. The user subsequently authorized the prepared migration and API restart; see activation results below. No real handover or student feedback was created for verification.
- Independent review: reproduced and fixed delayed-response UI overwrite and ambiguous general-submission retries. A follow-up reproduced stale responses deleting newer drafts; this also has a passing regression. Async completion is scoped to the originating account/session/form. Pending submissions retain their original payload, with editing locked until an exact idempotent retry is confirmed.

## Verification results

- `cd server; npm test`: 16/16 pass. These tests use isolated repositories and PGlite, not the connected Supabase project. The test script deliberately targets `tests/*.test.mjs` and avoids legacy root scripts that can mutate live data.
- `cd mobile; npm test`: 102/102 pass, including three admin filter/error/metrics interaction tests using the existing JSX test toolchain.
- `cd mobile; node node_modules/expo/bin/cli export --platform android --output-dir .expo/recovery-feedback-export`: succeeds. This checks Android bundling; it is not a newly distributed APK. Expo reports an existing `expo-file-system/next` export fallback warning.
- `cd web; npm run build` and `npm run lint`: succeed; lint reports existing warnings outside the feedback work.
- `git diff --check`: passes.
- Browser automation could not initialize because its Windows sandbox helper failed. Physical-device rendering, TalkBack, keyboard, themes and enlarged-text layout still need manual acceptance checks; simulated controls and theme tests are not a substitute for device visual verification.

## API contract

All routes require a server-issued bearer session. Student routes require the upgraded, Google-bound session; current role and active status are rechecked from storage.

- `GET /api/feedback/recoveries`: the student's durable handovers, measured hours and saved recovery response.
- `POST /api/feedback`: student-only; `kind`, integer `rating` (1–5), optional-content `comment` string, UUID `request_id`, and `recovery_id` for recovery feedback. Identity, names and timestamps are server derived. Replaying identical content with the same request ID returns the original response. Conflicting content or a second recovery response returns 409.
- `GET /api/feedback`: admin-only read list with recovery context; no admin submission path.
- `GET /api/feedback/summary`: admin-only measured statistics and monthly handover cohorts, independent of report-volume forecasting.
- `POST /api/lost-items/:id/claim`: admin-only; requires `found_item_id`, `id_verified: true`, `knowledge_passed: true` and optional notes. The server invokes the atomic database handover function. Repeat confirmation returns the same recovery event and timestamp.

## Rollout

Apply `server/add-recovery-feedback.sql` only after explicit approval. Deploy server support before clients. The feature fails visibly if the migration or server is unavailable, rather than claiming submissions succeeded or showing fabricated metrics. Google users must sign in again once to obtain the upgraded session. Existing unlinked legacy users require a separate authenticated linking workflow.

Before deployment, confirm server-only `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `JWT_SECRET` are configured; keep the service key out of mobile/web configuration. Inspect the existing production schema against the migration and take a backup before applying it. Use the deployment's normal server start procedure; do not start the embedding poller against live data merely for this feature's tests. After migration and server deployment, rebuild/distribute the mobile APK and verify one isolated test handover, feedback submission and admin result before broad release.

Tracking starts at migration installation, not the earliest existing report. Metrics count durable handovers once, including returns without feedback; invalid durations are excluded. General feedback is never included in recovery satisfaction or speed statistics.

## Authorized live activation — 17 October 2026

- User approved applying the migration and restarting the backend after the old API was confirmed to return 404 and the new tables were absent.
- Captured a schema-only preflight snapshot in ignored `server/recovery-feedback-preflight.local`; this is not a full data backup. Existing table columns and timestamp types match the prepared migration.
- Applied migrations `20261017132616_connected_recovery_feedback` and `20261017133028_allow_superadmin_recovery_verification` to the configured Lost and found DB project. The second preserves the existing active `superadmin` account's administrator capabilities, without granting student submission privileges. Regression tests failed before this compatibility fix and pass afterward.
- Restarted the existing local API on port 3001, preserving its normal background embedding service. Verified authenticated feedback list and summary return HTTP 200 both directly and through the admin Vite proxy on port 5173. Anonymous summary requests return 401; password-only students receive 403 for admin summaries and Google-only recovery access.
- Tracking started at `2026-10-17T13:26:16.527468Z` (9:26 PM in the school timezone). Both new data tables remain empty; old item statuses were not converted into recovery events.
- Verified RLS is enabled, anonymous table reads and authenticated direct inserts are denied, the service role retains access, and anonymous callers cannot execute the handover function.
- Security advisor reports informational no-policy notices for these intentionally server-only tables. Separate pre-existing errors remain for disabled RLS on `activity_logs` and `qr_locations`; changing those legacy access paths is outside this activation. See [Supabase RLS remediation](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public).
- Mobile distribution still requires rebuilding/installing the updated APK. Device visual and screen-reader acceptance checks remain outstanding.

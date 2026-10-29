# Report and chat notification badges

Web: the authenticated NotificationProvider fetches IDs from GET /api/notifications. An authenticated fetch stream at GET /api/notifications/stream invalidates the affected list when Supabase reports a database change. Lost/found pages reload their records, and Messaging reloads the inbox and selected conversation. Report badges clear one item at a time only after the admin opens that report’s View details dialog. Opening, revisiting, searching, filtering, or refreshing a list does not acknowledge any report. Unread reports use a tinted row, accent edge, stronger title, and an Unread label. Viewed reports use a neutral row and an explicit checkmark/Viewed label. Separate light/dark theme tokens preserve readable text and high-contrast support. All sidebar and conversation count badges use a dedicated red color across themes. Web writes through the API client also invalidate immediately.

Mobile: MessageBadgeProvider owns the conversation and message snapshot. It subscribes to the user's existing name-based conversation and that conversation's messages. The Messages screen acknowledges displayed admin messages only while focused, foregrounded, and successfully loaded. Tab presses do not acknowledge unread data by themselves.

Read state is stored per account on the current device (localStorage on web, AsyncStorage on mobile). IDs of reports whose details were opened and messages in a viewed conversation are saved instead of subtracting totals. Read acknowledgement runs after the selected detail/conversation renders and only while the browser tab is visible. The v3 browser receipt format discards old report list-visit markers once and preserves existing message receipts. Web chat counts only user messages, mobile counts only admin messages. Reading one web conversation leaves other conversations unread. Receipts survive reloads/restarts; they are not synced between devices. The existing name-based conversation identity contract is preserved.

## Enable live events on an existing Supabase database

Run server/enable-realtime-notifications.sql once in the project's Supabase SQL Editor. It adds public.lost_items, public.found_items, public.messages and public.conversations to supabase_realtime, preserving existing tables and policies. The script is idempotent and is also included in supabase-schema.sql for new databases. It changes publication configuration, not user records.

Both server/index.js and server/start-public.js mount the notification routes. Restart/deploy the Express server and web app with these changes, and rebuild/reload the mobile app (Metro now watches the shared helper directory). No new environment variables or dependencies are required.

A read-only readiness probe on 2026-10-29 rejected the conversations subscription with: Unable to subscribe to changes with given parameters. Realtime must be enabled in the live project before instant delivery can be confirmed. Publication configuration was not changed by these local code edits.

Both clients refresh every 10 seconds while foregrounded and refresh after focus/reconnect, covering missed events and publication/connection failures. Failed requests preserve the last successful badge rather than substituting zero. Existing RLS and authentication behavior outside the new admin notification endpoints is unchanged.

## Verification

- Web production build and lint; web regression tests.
- Headless Chrome with the real React components and Express notification router against an isolated database mock: live reports, per-conversation counts, outgoing exclusion, read persistence, error retention, desktop and narrow navigation.
- Mobile regression suite, actual provider lifecycle tests, and Android production JavaScript/Hermes export.
- Isolated HTTP tests for current admin role/status, snapshot pagination/errors, stream event delivery and cleanup.
- Isolated PostgreSQL publication migration test: run twice and preserve an existing publication table.

A physical-device session and a live Supabase write/read test remain necessary after the publication is enabled. Test with separate admin/student sessions: report a lost/found item, receive it in the web badge, send a student chat, reply as admin, and verify each recipient badge clears after viewing that conversation.

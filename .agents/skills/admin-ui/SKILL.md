---
name: admin-ui
description: Improve or review the Lost & Found React web admin with modern professional design, accessible interactions, responsive layouts, and functional checks. Use for admin pages, shared components, themes, forms, tables, charts, and navigation in web/; not for React Native screens or API-only work.
---

# Admin UI work

Work in `web/`. The admin uses React, Vite, React Router, Tailwind CSS, Heroicons, and Chart.js. Read the affected page, its route in `web/src/App.jsx`, and related components before editing. Reuse `web/src/components/layout/` and `web/src/components/common/` where they support the requested flow. Keep the existing API contract unless behavior changes are part of the task.

## Modern professional design

Make the requested screens feel coherent, polished, and easy to operate while preserving the project's branding. Use a clear heading hierarchy, readable typography, consistent spacing and alignment, and deliberate content density. Apply restrained color, borders, shadows, and corner radii consistently. Keep primary actions prominent and secondary actions easy to distinguish.

Use the existing theme tokens in `web/src/index.css` and settings from `web/src/context/AppContext.jsx`. Maintain light/dark mode, color themes, high contrast, text sizing, and privacy masking where the affected flow supports them. Improve inconsistencies within the requested scope; do not turn a focused change into a whole-dashboard redesign. Prefer the current icon and component systems before adding packages.

For tables, keep headings, status labels, row actions, search, filters, and pagination understandable. For dashboards and charts, make labels, units, date ranges, and empty results clear. Use subtle transitions when they help orientation and respect the browser's reduced-motion preference.

## Working behavior and accessibility

Trace each visible action to its handler and response. Check validation, disabled/submitting states, repeated clicks, feedback after success or failure, and whether refreshed data reflects the change. Preserve filter and selection state where appropriate. Provide useful loading, empty, and error states instead of controls that only appear functional.

Check desktop, tablet, and narrow layouts. Allow intentional table scrolling without clipping controls or causing page-wide overflow. Check keyboard access, visible focus, labelled inputs and icon buttons, readable contrast, and modal focus/close behavior. Status meaning must remain understandable without color alone. Make enlarged text usable.

Follow requests through `web/src/services/api.js`; some matching and verification components also call `fetch` directly. Keep authentication headers and API-base behavior intact when changing those paths. Distinguish preferences persisted in browser storage from settings saved through the API.

## Verification

Run `npm run build` and `npm run lint` from `web/` for code changes. Inspect the changed flow in a browser when available, including relevant theme and screen-size variants, keyboard use, and submission feedback. Use isolated or mocked data for verification that changes records. Before starting Express against live credentials, inspect its background embedding poller in `server/index.js`.

Report the pages changed, behavior and visual states checked, and any remaining browser or backend limitation. A successful build alone does not prove that a control works or that its layout is correct.

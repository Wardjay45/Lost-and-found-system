# Implementation verification — 21 October 2026

## Implemented

- Forecast utility corrects the fitted intercept, uses campus calendar months, excludes initial/current partial months, requires three complete months, and uses up to six recent months.
- Ruling: next calendar month is **two steps** after the last complete training month. The display names the target month. Backtests use the same horizon, requiring five complete months for the first held-out evaluation. This prevents validating a different task from the displayed forecast.
- Full report lists page through Supabase results instead of truncating forecast history at the first page; retrieval failures do not become partial successful history.
- Mobile font size, high contrast, TTS, larger targets and reduced motion persist. Hydration preserves choices made during launch. Shared buttons expose roles/states and minimum targets; themed typography scales existing font sizes and line heights.
- Reporting selectors announce category/selected states; browsing preserves full descriptions and switches card arrangement at enlarged text sizes; accessibility settings wrap size choices and show explicit selection marks. Profile reduced-motion behavior is preserved.
- Ruling: the legacy mobile AI search used keyword overlap and ignored photos. It now calls the existing CLIP/E5 API. The API filters available candidates before ranking, preventing returned items from hiding eligible recommendations. The existing response contract and default weights remain.
- Location creation and active-state validation are checked in isolation. Admin requests guard repeated submissions and show failures; deletion resets its pending state after both success and failure. No live campus locations or history were changed.
- Offline evaluation shares production scoring and records all three modalities, metrics, failure/coverage counts, visual groups, split, threshold, weights, local timing scope, model revisions, package versions and input hashes. Templates and a trial procedure are in this directory.

## Verification evidence

- Web forecast tests, production build and lint checked. Lint retains existing unused-code/Fast Refresh warnings.
- Mobile full regression suite and Android export checked. Export retains the existing `expo-file-system/next` fallback warning; no new APK was distributed.
- Server regression suite includes real isolated HTTP/Postgres recovery checks, location lifecycle, paginated history and pre-ranking eligibility. No live test records were written.
- AI tests exercise score parity with the former NumPy calculation, the API response shape, known-answer metrics, split/manifest validation, and CLI fixture evidence labeling.
- Offline CLIP/E5 smoke test loaded the already cached models and ran image/text/combined matching without database/network access. It used an identical repository-logo fixture, explicitly marked synthetic. Its scores are not study accuracy results.
- Browser checks exercised complete/insufficient forecast history, next-month targets, narrow layout, mocked location add/toggle/delete/retry, and confirmed AB BUILDING remained intact in the isolated fixture.
- Mobile JSX component previews were inspected at 150% app text size in three themes under normal vision, protanopia, deuteranopia, tritanopia and achromatopsia emulation. These previews and component tests do not exercise the native Android layout engine or TalkBack.
- Independent code review completed; forecast-horizon, ranking-eligibility, location-delete-state and photo-label contrast findings were corrected and rechecked.

## Still requires actual study work

Add the official campus list through admin. Obtain approved sample sizes/targets and verified labeled items, run the final test once, conduct comparable recovery trials, and perform real-device/TalkBack/user accessibility checks. An Android emulator was available but had no app installed; it was shut down after inspection. Speech-to-text remains deferred. Actual recovery-speed and matching-accuracy conclusions are not established by these software checks.

Backend/AI source changes require restarting those existing services; mobile changes require a development reload or a newly built APK. No database migration or public API addition is needed.

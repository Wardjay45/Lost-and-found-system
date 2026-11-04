# Prophet predictive analytics

The Analytics page includes **Expected found items**. It uses the supplied UBC monthly CSV with a **1 week / 1 month / 1 year** time-frame selector. Weekly estimates prorate the next monthly forecast over seven days; monthly estimates use one monthly forecast; yearly estimates total twelve monthly projections. One summary card shows the estimate and its range beside the historical chart. Live report totals and the restored descriptive analytics remain separate: full-width report history, side-by-side status/category charts, system totals, and colored location tiles. The duplicate local linear forecast is not displayed.

## Data and model

The supplied monthly file has 12 observations and 138 recorded found items from May 2024 through November 2026. Those counts reconcile with all 138 rows in the supplied original CSV, using `Date Found` to count each month. The original record-level file is not bundled or imported into Supabase. Only the monthly counts and aggregate source metadata are included in the Python service.

There are 19 unobserved months between November 2024 and May 2026. They remain absent from model training and appear as null gaps in the chart, not invented zero-count observations. A recorded zero, if present in a future source, stays a genuine zero.

The latest original record is November 2, 2026. Completeness is unknown; the first and last observed months may be partial. All 12 supplied observations are retained, and the interface states that this is a temporary, experimental UBC **found-item** dataset, not confirmed lost reports or Philippine lost-item statistics.

Pandas reads and validates `ds` and `y`, converts dates/counts, rejects invalid dates, duplicate months, negative/fractional counts, and fewer than three observed months, then sorts the history. Prophet fits the observed trend with yearly, weekly, and daily seasonality disabled. It predicts month starts (`MS`) after the last observation: one month for weekly/monthly views, or twelve months for the yearly view. For this extract, the forecast begins December 2026 and the yearly view ends November 2027. The forecast month is anchored to the dataset, not silently moved to the current date when the extract becomes stale. The minimum three historical observations are training data. The weekly display is a rate-based estimate, not a separate weekly Prophet fit; no daily or weekly observations are invented.

One card shows the approximate whole-item estimate and exact date window for the selected time frame. The estimated range is rounded outward to whole counts; the API still preserves three decimals. A short chart shows six recent calendar months plus one or twelve projected months, depending on the selected horizon. Its legend explicitly uses monthly counts in every view. The yearly total has no combined prediction interval because summing monthly marginal bounds would not define one. The forecast uses a dashed line and a diamond marker; historical values use a solid line and circular markers. Its connection starts at the last recorded count, which is not shown or described as an estimated observation. Older source data remains available through **About this forecast → Show all history**. Missing months stay blank in either view. Negative model estimates and interval endpoints are clipped at zero because records are counts.

The configured 80% prediction range expresses model assumptions, not 80% accuracy or guaranteed coverage. Accuracy has not been evaluated. Limited observations, the long gap, and possibly partial months limit this demonstration. Prophet's official documentation describes [monthly forecasting](https://facebook.github.io/prophet/docs/non-daily_data.html#monthly-data) and the assumptions behind [uncertainty intervals](https://github.com/facebook/prophet/blob/main/docs/_docs/uncertainty_intervals.md).

## Request path and updates

`Analytics → analyticsApi.getForecast() → GET /api/analytics/forecast on Express → GET /api/analytics/forecast on FastAPI → Pandas CSV provider → Prophet → validated JSON → Chart.js and the selected time-frame summary`.

Express requires an active admin or superadmin session even in local development. It forwards to the existing `AI_SERVER_URL` through `aiFetch`, keeping `AI_SERVICE_KEY` on the server. The Python route uses the existing service-key middleware. Error responses do not expose filesystem paths or upstream exception text. The forecast section loads independently from local dashboard data, so one service's failure does not hide the other section.

The Python service caches results separately for one-month and twelve-month horizons per dataset revision per worker; weekly and monthly views share the one-month fit. A lock prevents simultaneous fits, and a content fingerprint of the validated data and metadata invalidates the cache when the source changes. Browser focus/reconnect and the existing automatic update cycle reload results; an unchanged CSV does not retrain every time. Errors retain the last successful forecast with a visible warning; initial failure shows an error and retry without fabricating numbers.

## Install and run locally

Use Python 3.12, as configured by the existing Python project. New direct dependencies are `pandas==3.0.2` for reading/validating monthly data and `prophet==1.5.0` for fitting/prediction. Prophet installs CmdStanPy and its packaged Stan backend. The frontend reuses the installed Chart.js packages; no new JavaScript dependency or database migration is required.

Run each service in a separate PowerShell terminal.

Python:

```powershell
cd 'E:\Lost and found-admin\ai-server'
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:AI_SERVICE_KEY = 'choose-a-local-service-key'
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Express (retain the existing development Supabase/JWT configuration in `server/.env`):

```powershell
cd 'E:\Lost and found-admin\server'
npm ci
$env:AI_SERVER_URL = 'http://127.0.0.1:8000'
$env:AI_SERVICE_KEY = 'choose-a-local-service-key'
npm run dev
```

The two service-key values must match. The existing Express startup also runs the background embedding poller; use development database credentials for local system testing.

Frontend:

```powershell
cd 'E:\Lost and found-admin\web'
npm ci
npm run dev
```

Open the Vite URL, sign in with an active administrator account, and visit **Analytics**. Vite's existing `/api` proxy reaches Express on port 3001. Python stays on port 8000. Do not put the service key in a `VITE_` variable or send it from the browser.

For deployment, install the updated Python requirements and include the entire `analytics/` package, CSV, and JSON metadata with the Python service. Retain matching `AI_SERVICE_KEY` values and the correct `AI_SERVER_URL` on the existing services; deploy the web/Express changes too. Local implementation and verification do not deploy the hosted services or alter live data.

## Test the API and interface

Direct Python endpoint, in the Python terminal's environment:

```powershell
Invoke-RestMethod 'http://127.0.0.1:8000/api/analytics/forecast' -Headers @{ Authorization = "Bearer $env:AI_SERVICE_KEY" }
```

The response contains `historical`, `forecast`, `dataset`, `model`, `warnings`, and `generated_at`. Confirm 12 historical rows, exactly one forecast row, `model.horizon_months: 1`, 19 missing months, `yearly_seasonality: false`, and `interval_width: 0.8`. The API and browser reject extra future months rather than merely hiding them. Repeated requests to the same unchanged worker return the cached `generated_at`. Without the configured service key, the Python route returns 401.

To verify the full admin API after signing in, run this in the browser console on the local app:

```javascript
fetch('/api/analytics/forecast', {
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
}).then(response => response.json()).then(console.log);
```

Confirm that the page shows the UBC sample-data label, one estimate card with its range, a solid recorded-items series, and one future estimate joined by a dashed line. In the monthly view only December 2026 is projected. Select the yearly view to display December 2026 through November 2027; select the weekly view to see the prorated December 1–7 estimate. Verify all three buttons, date windows and counts, including rapid switching. Open **About this forecast → Show all history** to see older observations: the long historical gap must be blank, not a zero-valued line. Check desktop and narrow screens, light/dark mode, enlarged text/high contrast, keyboard access to forecast details, the Monthly/Weekly control for live reports, and automatic updates. Temporarily stop Python to check the visible error/retry state; restart it and allow an automatic update or use the error-only retry.

Regression commands:

```powershell
# From ai-server, with the forecasting environment active
python -m unittest discover -s tests

# From server
node --test tests/analytics.test.mjs tests/aiClient.test.mjs

# From web
npm test
npm run build
npm run lint
```

Current one-month verification: nine Python forecasting tests (including a real Prophet/FastAPI call and rejection of extra forecast months), three targeted Express/service-client tests, and 34 web tests passed. The production build passed; lint completed with existing unused-code and Fast Refresh warnings. Earlier scoring/evaluation tests remain unchanged. The local test environment used Python 3.13; the deployment project continues to declare Python 3.12.

Headless Chrome checked the actual running local API and Analytics page: the response declares `horizon_months: 1` and contains only December 2026 for this extract, one forecast card appears, and no January or February 2027 forecast is displayed. The restored descriptive layout, history controls, Monthly/Weekly reports, automatic updates, 1440px/820px/390px light and dark layouts, and enlarged high-contrast text were verified. The old cached three-month worker was replaced with a normal Python process, and Express was restarted to load the updated response validator. Both services remain running locally. Browser API writes were blocked during verification; no reports or database schema were changed.

## Later: use your own Supabase history

Implement another provider with `load() -> MonthlyHistory(frame, dataset)`, then inject it into `ForecastService(source=...)`. Keep Prophet and the response contract unchanged. The provider should query approved system records with established server credentials and group lost reports by `lost_items.date_reported` or found reports by `found_items.date_found`, using a declared reporting timezone and the same first-of-month `ds` keys.

Choose and document whether to forecast lost reports, found reports, or each separately. Do not merge the two types into a falsely labelled count. Paginate complete record history, validate collection coverage and incomplete months, and treat missing coverage as unavailable. Zero-count months are appropriate only where collection coverage is known to be complete. Revalidate `ds`/`y`, update provenance/completeness metadata and the found-item-specific UI labels when the metric changes, and use temporal holdout/backtesting before making accuracy claims. The current CSV source is not automatically replaced, and this feature does not read or write Supabase reports.

## Files in this implementation

Created:

- `ai-server/analytics/__init__.py`
- `ai-server/analytics/forecasting.py`
- `ai-server/analytics/routes.py`
- `ai-server/analytics/ubc_monthly_forecasting.csv`
- `ai-server/analytics/ubc_dataset.json`
- `ai-server/tests/test_forecasting.py`
- `server/routes/analytics.js`
- `server/tests/analytics.test.mjs`
- `shared/forecast.mjs`
- `web/src/components/analytics/PredictiveAnalytics.jsx`
- `web/src/services/forecastChart.mjs`
- `web/tests/forecastChart.test.mjs`
- `docs/predictive-analytics.md`

Modified:

- `ai-server/main.py` — mount the forecasting router.
- `ai-server/requirements.txt`, `ai-server/pyproject.toml` — pin forecasting dependencies.
- `server/app.js`, `server/start-public.js` — mount the authenticated proxy.
- `web/src/services/api.js` — add the forecast API client.
- `web/src/pages/Analytics.jsx` — place the new section and distinguish local report analytics.
- `web/src/index.css` — add responsive, theme-aware forecast styling.

The earlier potential-match/realtime changes in the same checkout are preserved.

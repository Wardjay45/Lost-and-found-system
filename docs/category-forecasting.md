# Category forecasting

Analytics now displays monthly expected report counts by category. Select **Current Data** for retained campus database records or **Historical Data** for the uploaded CSV experiment. Lost and Found remain separate filters. These sources are never combined.

Historical Data uses the documented **synthetic gap scenario** from `lost_found_gap_scenario.csv`, preserving the seven uploaded categories and all 145 original CSV rows. Only aggregate counts are bundled: 126 original eligible Lost records plus 390 generated Lost records in the 19 absent months from November 2024 through May 2026. The model therefore has 516 Lost records across 29 calendar months, June 2024 through October 2026. Counts in every original-input month remain unchanged. First/last source months and non-Lost rows remain excluded. No report records are imported into the campus database, and there are no confirmed Found records in the historical source.

This alternative scenario replaces the earlier zero-count assumption only for the Historical Data experiment. It does not recover missing real history. Validation November 2025-April 2026 is entirely simulated; the May-October 2026 test contains simulated May and five original-input months. These source targets have already been examined in earlier experiments, so this is exploratory rather than a fresh independent final test. Its next forecast month remains November 2026 until the source changes.

The generation seed is 20261117. Only the five source months June-October 2024 calibrate category rates. One Gamma posterior rate is drawn per category using a Gamma(shape=0.5, rate=0.5) prior. Common and category-specific log-rate states add persistent random variation; counts use a Gamma-Poisson distribution with intensity shape 6. No campus calendar, seasonality or population trend is assumed. The seed and parameters were fixed before this scenario's model evaluation; no results were tuned to favour a method. Source hashes, rate draws, assumptions, simulated-month keys and limitations are retained in the dataset metadata. These are illustrative count patterns, not verified campus behaviour.

Current Data reads `date_reported` for lost reports and `date_found` for found items. Found dates can differ from submission dates. Counts use Asia/Manila months, exclude the first recorded month and current partial month, and include intervening months with zero retained records. Deleted records and earlier gaps can affect coverage. Category IDs resolve to current category names, with stored names as fallback and Uncategorized for missing categories.

## Model protocol

The Python implementation mirrors the supplied Colab protocol:

| Method | Settings |
|---|---|
| Prophet | Linear trend, no seasonalities, at most five changepoints, seed 42 |
| ARIMA | Order (1,1,0), drift |
| Exponential Smoothing | Simple level-only smoothing, estimated initialization |
| Previous-month baseline | Last observed monthly count |

At least 18 complete months are required. The last six months are test months and the preceding six are validation months. Each fold trains only on earlier observations and predicts the next month. Previous test observations enter subsequent training as they become available. Lowest validation MAE selects among the three fitted methods, followed by validation RMSE and method name for ties. Test scores never choose the method. Model failures and convergence warnings remain visible and are excluded from selection. The chosen method is refitted on all complete months for the next-month estimate.

MAE is mean absolute error and RMSE is root mean squared error, both measured in reports per month. MASE divides MAE by the mean absolute lag-one difference in training counts. RMSSE divides RMSE by the square root of the mean squared lag-one difference in training counts. Both denominators use the fixed history before the relevant validation or test phase, never its target observations. The nonseasonal lag is one month. A zero denominator returns JSON null, exported as N/A with a constant-training-history note. No epsilon or invented observations replace undefined scores. These are errors, not accuracy percentages. Predictions are floored at zero and scored without rounding. All methods use the same target months. Failed methods can show partial metrics and must not be described as a completed comparison. Sparse all-zero validation periods can make selection uninformative. Compare the final test results with the baseline and report ties honestly.

The original practice input already contains generated status and location fields. Generated Found statuses are excluded, and no individual ticket numbers, descriptions, or locations are published. The historical dashboard keeps a concise practice-data notice, uses the neutral legend **Historical counts**, and identifies simulated months in historical-point tooltips. The complete provenance and evaluation limitations remain in About these forecasts and the evaluation download. Current campus data remains separate. These results demonstrate an internally checked evaluation under declared assumptions and do not establish real-world forecasting accuracy.

The documentation download includes validation and test MAE, RMSE, MASE and RMSSE, scale availability notes, dataset kind, data source, report type, the validation-selected method flag and the evaluation-basis disclosure. Selection remains based on validation MAE and RMSE. Reference for scaled-error definitions: https://otext.robjhyndman.com/hyndsight/rolling_mase.html

The main dashboard shows a separate line-chart card for each category in a responsive grid. Each chart shows six recent historical months and three dashed forecast segments from the last historical count to the next-month estimates from Prophet, ARIMA, and Exponential Smoothing. The final month is marked with an asterisk and the forecast date is displayed in the card header. A shared legend identifies the historical line and the three methods. These are one-step forecasts, not fabricated multi-month projections. Tables, score cards, and visible MAE/RMSE values are omitted from the main view. Evaluation results remain available as a CSV download under About these forecasts for documentation. Missing or failed forecasts and final fits with convergence warnings are left blank rather than plotted as zero. Category histories with fewer than 18 months show an insufficient-history state within their card. Current Data never substitutes external historical records.

Card headers show the category and forecast date, without an extra expected-count or selected-method summary. The three forecast lines and shared model legend remain available for comparison. The six historical points are input counts, not past forecasts. For this scenario they cover May-October 2026: May is simulated, while June-October retain the original practice-file counts. Their totals across all seven categories are 32, 2, 3, 2, 20 and 5. Every category's final model fit uses the full 29-month series and estimates November 2026; chart trimming does not restrict training to six months.

## Running locally

Install the AI service dependencies using its normal environment, including `prophet==1.5.0` and `statsmodels==0.14.6`. Restart the Python service and Express server, and reload Analytics. No database migration is required. The first request evaluates models and may take several minutes. Results are cached per complete input history in each Python worker, with eight revisions retained.

For local forecasting without loading image/text embedding models, run `./start-forecast.ps1` from the repository root. This starts `forecast_app:app` on 127.0.0.1:8000, the default AI service address. Use either this forecast entry point or the full `main:app` on that port. The forecast entry point serves analytics only. If the full AI service is already running, it already exposes the forecast routes and no second process is needed.

Endpoints: the authenticated Express `GET /api/analytics/category-forecast?source=current|historical&itemType=lost|found` forwards current aggregated history to the Python POST endpoint or requests its historical GET endpoint. Existing total forecast endpoints remain compatible with other consumers.

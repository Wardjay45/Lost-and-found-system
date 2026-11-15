# Category forecasting

Analytics now displays monthly expected report counts by category. Select **Current Data** for retained campus database records or **Historical Data** for the uploaded CSV experiment. Lost and Found remain separate filters. These sources are never combined.

Historical Data preserves the seven uploaded categories. It excludes blank statuses and the first and last observed months. It has 126 eligible Lost records over June 2024 through October 2026, including zero months confirmed by the user. There are no confirmed Found records. The external history is not evidence of DNSC forecasting accuracy. Its next forecast month remains November 2026 until the source file is updated.

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

The latest supplied `lost_found_practice_filled(1).csv` is a practice copy with generated status and location fields. Its monthly Lost-only aggregate has the same 203 category-month rows and 126 eligible Lost records as the earlier history. Its dataset metadata and dashboard notice explicitly identify it as practice data. Generated Found statuses are excluded, and no individual ticket numbers, descriptions, or locations are published. Current campus data remains separate. Results from this upload are practice evaluation, not evidence of real-world forecasting accuracy.

The documentation download includes validation and test MAE, RMSE, MASE and RMSSE, scale availability notes, dataset kind, data source, and report type. Selection remains based on validation MAE and RMSE. Reference for scaled-error definitions: https://otext.robjhyndman.com/hyndsight/rolling_mase.html

The main dashboard shows a separate line-chart card for each category in a responsive grid. Each chart shows six recent recorded months and three dashed forecast segments from the last observed count to the next-month estimates from Prophet, ARIMA, and Exponential Smoothing. The final month is marked with an asterisk and the forecast date is displayed in the card header. A shared legend identifies the recorded line and the three methods. These are one-step forecasts, not fabricated multi-month projections. Tables, score cards, and visible MAE/RMSE values are omitted from the main view. Evaluation results remain available as a CSV download under About these forecasts for documentation. Missing or failed forecasts and final fits with convergence warnings are left blank rather than plotted as zero. Category histories with fewer than 18 months show an insufficient-history state within their card. Current Data never substitutes external historical records.

## Running locally

Install the AI service dependencies using its normal environment, including `prophet==1.5.0` and `statsmodels==0.14.6`. Restart the Python service and Express server, and reload Analytics. No database migration is required. The first request evaluates models and may take several minutes. Results are cached per complete input history in each Python worker, with eight revisions retained.

For local forecasting without loading image/text embedding models, run `./start-forecast.ps1` from the repository root. This starts `forecast_app:app` on 127.0.0.1:8000, the default AI service address. Use either this forecast entry point or the full `main:app` on that port. The forecast entry point serves analytics only. If the full AI service is already running, it already exposes the forecast routes and no second process is needed.

Endpoints: the authenticated Express `GET /api/analytics/category-forecast?source=current|historical&itemType=lost|found` forwards current aggregated history to the Python POST endpoint or requests its historical GET endpoint. Existing total forecast endpoints remain compatible with other consumers.

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])-01$/;
const isCount = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function nextMonth(month) {
  const date = new Date(month + 'T00:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

// Enforce the Python/Express/browser boundary before charting or displaying data.
export function validateForecastResponse(data) {
  const invalid = () => { throw new Error('The forecasting service returned an invalid response.'); };
  if (!data || !Array.isArray(data.historical) || data.historical.length < 3 || !Array.isArray(data.forecast) || data.forecast.length !== 1) invalid();
  let previous = '';
  for (const row of data.historical) {
    if (!row || !monthPattern.test(row.ds) || row.ds <= previous || !isCount(row.y) || !Number.isInteger(row.y)) invalid();
    previous = row.ds;
  }
  for (const row of data.forecast) {
    if (!row || row.ds !== nextMonth(previous) || !isCount(row.yhat)) invalid();
    const { yhat_lower: lower, yhat_upper: upper } = row;
    if (!(lower === null && upper === null) && (!isCount(lower) || !isCount(upper) || lower > upper)) invalid();
    previous = row.ds;
  }
  if (!data.dataset || typeof data.dataset.name !== 'string' || typeof data.dataset.description !== 'string' || typeof data.dataset.source !== 'string' ||
      typeof data.dataset.temporary !== 'boolean' || data.dataset.observed_months !== data.historical.length ||
      data.dataset.first_observed_month !== data.historical[0].ds || data.dataset.last_observed_month !== data.historical.at(-1).ds ||
      data.dataset.total_records !== data.historical.reduce((total, row) => total + row.y, 0) ||
      !Array.isArray(data.dataset.missing_months) || data.dataset.missing_month_count !== data.dataset.missing_months.length ||
      data.dataset.missing_months.some(month => !monthPattern.test(month)) ||
      !Array.isArray(data.warnings) || !data.warnings.length || data.warnings.some(value => typeof value !== 'string') ||
      data.model?.name !== 'Prophet' || data.model.horizon_months !== 1 || data.model.yearly_seasonality !== false ||
      typeof data.model.interval_width !== 'number' || data.model.interval_width <= 0 || data.model.interval_width >= 1) invalid();
  const observed = new Set(data.historical.map(row => row.ds)), missing = [];
  for (let month = data.historical[0].ds; month <= data.historical.at(-1).ds; month = nextMonth(month)) {
    if (!observed.has(month)) missing.push(month);
  }
  if (JSON.stringify(missing) !== JSON.stringify(data.dataset.missing_months)) invalid();
  return data;
}

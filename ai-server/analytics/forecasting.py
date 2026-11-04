"""Prophet forecasts over observed monthly counts; no missing-month imputation."""
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
from threading import Lock
from typing import Protocol

import pandas as pd

FORECAST_HORIZON_MONTHS = 1


class ForecastError(Exception):
    def __init__(self, message, status_code=503):
        super().__init__(message)
        self.status_code = status_code


def validate_monthly_history(frame):
    if not {"ds", "y"}.issubset(frame.columns):
        raise ForecastError("Historical data must include ds and y columns.", 422)
    data = frame[["ds", "y"]].copy()
    try:
        data["ds"] = pd.to_datetime(data["ds"], errors="coerce")
        data["y"] = pd.to_numeric(data["y"], errors="coerce")
        dates_valid = data["ds"].notna().all() and data["ds"].dt.tz is None
        dates_valid = dates_valid and (data["ds"] == data["ds"].dt.to_period("M").dt.to_timestamp()).all()
        counts_valid = all(math.isfinite(float(y)) and y >= 0 and float(y).is_integer() for y in data["y"])
    except (TypeError, ValueError, AttributeError, OverflowError):
        dates_valid = counts_valid = False
    if not dates_valid or not counts_valid:
        raise ForecastError("Historical data needs valid month-start dates and nonnegative whole record counts.", 422)
    if data["ds"].duplicated().any():
        raise ForecastError("Historical data contains duplicate months. Supply one count per observed month.", 422)
    if len(data) < 3:
        raise ForecastError("At least three observed months are needed for this experimental forecast.", 422)
    return data.sort_values("ds").reset_index(drop=True)


@dataclass
class MonthlyHistory:
    frame: pd.DataFrame
    dataset: dict


class MonthlySource(Protocol):
    def load(self) -> MonthlyHistory: ...


class CsvMonthlySource:
    def __init__(self, csv_path=None, metadata_path=None):
        directory = Path(__file__).resolve().parent
        self.csv_path = Path(csv_path) if csv_path is not None else directory / "ubc_monthly_forecasting.csv"
        self.metadata_path = Path(metadata_path) if metadata_path is not None else directory / "ubc_dataset.json"

    def load(self):
        try:
            frame = pd.read_csv(self.csv_path)
            metadata = json.loads(self.metadata_path.read_text(encoding="utf-8"))
            if not isinstance(metadata, dict):
                raise ValueError("Invalid dataset metadata")
        except FileNotFoundError as error:
            raise ForecastError("The historical forecast dataset is unavailable.") from error
        except (OSError, ValueError, pd.errors.ParserError) as error:
            raise ForecastError("The historical forecast dataset could not be read.", 422) from error
        return MonthlyHistory(validate_monthly_history(frame), metadata)


def prophet_model(**options):
    try:
        from prophet import Prophet
    except ImportError as error:
        raise ForecastError("Forecasting is unavailable. The Python service needs its forecasting dependencies installed.") from error
    return Prophet(**options)


def forecast_monthly(history, *, model_factory=prophet_model, horizon_months=FORECAST_HORIZON_MONTHS):
    if horizon_months not in (1, 12):
        raise ForecastError('Choose a supported forecast horizon.', 422)
    data = validate_monthly_history(history.frame)
    model = model_factory(yearly_seasonality=False, weekly_seasonality=False, daily_seasonality=False,
                          interval_width=.8, n_changepoints=min(5, len(data) - 2), uncertainty_samples=1000)
    model.fit(data, seed=42)
    future = model.make_future_dataframe(periods=horizon_months, freq="MS", include_history=False)
    predicted = model.predict(future)
    expected = pd.date_range(data["ds"].max() + pd.offsets.MonthBegin(1), periods=horizon_months, freq="MS")
    if len(predicted) != horizon_months or list(pd.to_datetime(predicted["ds"])) != list(expected):
        raise ForecastError("The forecasting model returned an invalid monthly horizon.")

    def count(value):
        if not math.isfinite(float(value)):
            raise ForecastError("The forecasting model returned an invalid estimate.")
        return round(max(0., float(value)), 3)

    forecasts = []
    for row in predicted.to_dict("records"):
        point = count(row["yhat"])
        lower = count(row["yhat_lower"]) if row.get("yhat_lower") is not None else None
        upper = count(row["yhat_upper"]) if row.get("yhat_upper") is not None else None
        if (lower is None) != (upper is None) or lower is not None and lower > upper:
            raise ForecastError("The forecasting model returned an invalid uncertainty range.")
        forecasts.append({"ds": row["ds"].strftime("%Y-%m-%d"), "yhat": point, "yhat_lower": lower, "yhat_upper": upper})

    observed = set(data["ds"])
    missing = [date.strftime("%Y-%m-%d") for date in pd.date_range(data["ds"].min(), data["ds"].max(), freq="MS") if date not in observed]
    dataset = {**history.dataset, "observed_months": len(data), "total_records": int(data["y"].sum()),
               "first_observed_month": data["ds"].min().strftime("%Y-%m-%d"),
               "last_observed_month": data["ds"].max().strftime("%Y-%m-%d"),
               "missing_months": missing, "missing_month_count": len(missing)}
    warnings = ["Experimental demonstration with limited historical observations; forecast accuracy has not been validated.",
                "Missing months mean unavailable data, not zero found items. No missing months were added to training.",
                "The extract may contain incomplete first or last months. Recorded counts do not establish full reporting coverage.",
                "Prediction ranges reflect model assumptions and are not guaranteed outcomes or accuracy percentages."]
    if dataset.get("temporary"):
        warnings.insert(1, "This temporary UBC dataset describes found-item records, not Philippine lost-item statistics.")
    return {"historical": [{"ds": row.ds.strftime("%Y-%m-%d"), "y": int(row.y)} for row in data.itertuples()],
            "forecast": forecasts, "dataset": dataset, "warnings": warnings,
            "model": {"name": "Prophet", "horizon_months": horizon_months, "frequency": "MS", "yearly_seasonality": False,
                      "weekly_seasonality": False, "daily_seasonality": False, "interval_width": .8,
                      "count_floor": 0, "accuracy_evaluated": False},
            "generated_at": datetime.now(timezone.utc).isoformat()}


class ForecastService:
    """One fit per source revision per worker, shared safely by concurrent requests."""
    def __init__(self, source=None, model_factory=prophet_model):
        self.source = source if source is not None else CsvMonthlySource()
        self.model_factory = model_factory
        self._lock = Lock()
        self._key = None
        self._results = {}

    def get_forecast(self, timeframe='monthly'):
        if timeframe not in ('weekly', 'monthly', 'yearly'):
            raise ForecastError('Choose weekly, monthly or yearly.', 422)
        horizon = 12 if timeframe == 'yearly' else 1
        with self._lock:
            history = self.source.load()
            digest = hashlib.sha256((history.frame.to_csv(index=False) + json.dumps(history.dataset, sort_keys=True)).encode()).hexdigest()
            if digest != self._key:
                self._results, self._key = {}, digest
            if horizon not in self._results:
                self._results[horizon] = forecast_monthly(history, model_factory=self.model_factory, horizon_months=horizon)
            result = self._results[horizon]
            return result if timeframe == 'monthly' else {**result, 'model': {**result['model'], 'timeframe': timeframe}}

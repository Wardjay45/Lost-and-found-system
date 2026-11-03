from pathlib import Path
import json
import tempfile
import unittest
from unittest.mock import patch

import pandas as pd
from fastapi import FastAPI
from fastapi.testclient import TestClient

from analytics.forecasting import CsvMonthlySource, ForecastError, ForecastService, MonthlyHistory, forecast_monthly, validate_monthly_history
from analytics.routes import create_forecast_router


class ForecastTests(unittest.TestCase):
    def test_supplied_history_preserves_every_observation_and_the_large_gap(self):
        history = CsvMonthlySource().load()
        self.assertEqual(len(history.frame), 12)
        self.assertEqual(history.frame["y"].sum(), 138)
        self.assertEqual(history.frame["ds"].min(), pd.Timestamp("2024-05-01"))
        self.assertEqual(history.frame["ds"].max(), pd.Timestamp("2026-11-01"))
        self.assertNotIn(pd.Timestamp("2025-01-01"), set(history.frame["ds"]))

    def test_validation_sorts_numeric_strings_without_filling_missing_months(self):
        frame = pd.DataFrame({"ds": ["2024-05-01", "2024-01-01", "2024-03-01"], "y": ["2", "0", "4"]})
        valid = validate_monthly_history(frame)
        self.assertEqual(valid["y"].tolist(), [0, 4, 2])
        self.assertEqual(len(valid), 3)
        self.assertEqual(frame["y"].tolist(), ["2", "0", "4"])

    def test_invalid_columns_dates_counts_duplicates_and_short_history_fail(self):
        valid = pd.DataFrame({"ds": ["2024-01-01", "2024-02-01", "2024-03-01"], "y": [1, 2, 3]})
        cases = [valid.drop(columns="ds"), valid.iloc[:2], valid.assign(ds=["2024-01-01"] * 3)]
        for value in [None, "not-a-date", "2024-02-30", "2024-02-02", "2024-02-01T01:00:00Z"]:
            frame = valid.copy(); frame.loc[1, "ds"] = value; cases.append(frame)
        for value in [-1, .5, "bad", float("inf"), None]:
            frame = valid.astype({"y": object}); frame.loc[1, "y"] = value; cases.append(frame)
        for frame in cases:
            with self.subTest(frame=frame.to_dict("list")):
                with self.assertRaises(ForecastError): validate_monthly_history(frame)

    def test_csv_missing_unreadable_metadata_and_invalid_schema_have_safe_errors(self):
        with tempfile.TemporaryDirectory() as folder:
            csv = Path(folder) / "history.csv"; meta = Path(folder) / "metadata.json"
            with self.assertRaisesRegex(ForecastError, "dataset is unavailable"):
                CsvMonthlySource(csv, meta).load()
            csv.write_text("wrong,count\n2024-01-01,2\n", encoding="utf-8")
            meta.write_text("{}", encoding="utf-8")
            with self.assertRaisesRegex(ForecastError, "ds and y"):
                CsvMonthlySource(csv, meta).load()
            meta.write_text("{bad", encoding="utf-8")
            with self.assertRaisesRegex(ForecastError, "could not be read"):
                CsvMonthlySource(csv, meta).load()

    def test_model_uses_month_starts_no_seasonality_and_never_trains_on_missing_months(self):
        calls = {}
        class Model:
            def __init__(self, **options): calls["options"] = options
            def fit(self, frame, **options): calls["frame"] = frame.copy()
            def make_future_dataframe(self, **options):
                calls["future"] = options
                return pd.DataFrame({"ds": pd.date_range("2026-12-01", periods=1, freq="MS")})
            def predict(self, frame): return frame.assign(yhat=[-1], yhat_lower=[-4], yhat_upper=[2])
        result = forecast_monthly(CsvMonthlySource().load(), model_factory=Model)
        self.assertEqual(len(calls["frame"]), 12)
        self.assertEqual(calls["future"], {"periods": 1, "freq": "MS", "include_history": False})
        self.assertFalse(calls["options"]["yearly_seasonality"])
        self.assertFalse(calls["options"]["weekly_seasonality"])
        self.assertFalse(calls["options"]["daily_seasonality"])
        self.assertEqual(result["dataset"]["missing_month_count"], 19)
        self.assertEqual(result["forecast"][0]["yhat"], 0)
        self.assertEqual(result["forecast"][0]["yhat_lower"], 0)
        self.assertEqual(len(result["forecast"]), 1)
        self.assertEqual(result["forecast"][0]["ds"], "2026-12-01")
        self.assertEqual(result["model"]["horizon_months"], 1)
        self.assertFalse(result["model"]["accuracy_evaluated"])

    def test_cache_reuses_fits_and_retrains_on_a_changed_source_without_returning_stale_failures(self):
        history = CsvMonthlySource().load()
        class Source:
            fail = False
            def load(self):
                if self.fail: raise ForecastError("Dataset offline")
                return history
        source = Source(); service = ForecastService(source)
        with patch("analytics.forecasting.forecast_monthly", side_effect=[{"fit": 1}, {"fit": 2}]) as fit:
            self.assertEqual(service.get_forecast(), {"fit": 1})
            self.assertEqual(service.get_forecast(), {"fit": 1})
            self.assertEqual(fit.call_count, 1)
            history.frame.loc[0, "y"] = 7
            self.assertEqual(service.get_forecast(), {"fit": 2})
            source.fail = True
            with self.assertRaises(ForecastError): service.get_forecast()

    def test_real_prophet_api_returns_only_next_month_and_safe_json(self):
        app = FastAPI(); app.include_router(create_forecast_router())
        with TestClient(app) as client:
            response = client.get("/api/analytics/forecast")
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.headers["cache-control"], "no-store")
            data = response.json()
            self.assertEqual(len(data["historical"]), 12)
            self.assertEqual([row["ds"] for row in data["forecast"]], ["2026-12-01"])
            self.assertEqual(data["model"]["horizon_months"], 1)
            for row in data["forecast"]:
                self.assertGreaterEqual(row["yhat"], 0)
                self.assertLessEqual(row["yhat_lower"], row["yhat_upper"])
            self.assertEqual(client.get("/api/analytics/forecast").json(), data)
            self.assertNotIn(str(Path(__file__).resolve().parent), json.dumps(data))

    def test_model_cannot_return_extra_future_months(self):
        class Model:
            def __init__(self, **_options): pass
            def fit(self, _frame, **_options): pass
            def make_future_dataframe(self, **_options):
                return pd.DataFrame({"ds": pd.date_range("2026-12-01", periods=3, freq="MS")})
            def predict(self, frame): return frame.assign(yhat=7, yhat_lower=0, yhat_upper=20)
        with self.assertRaisesRegex(ForecastError, "invalid monthly horizon"):
            forecast_monthly(CsvMonthlySource().load(), model_factory=Model)

    def test_api_errors_do_not_expose_file_paths_or_internal_failures(self):
        class Broken:
            def get_forecast(self): raise RuntimeError("private-backend-path")
        app = FastAPI(); app.include_router(create_forecast_router(Broken()))
        with TestClient(app) as client:
            with self.assertLogs("analytics.routes", level="ERROR"):
                response = client.get("/api/analytics/forecast")
            self.assertEqual(response.status_code, 503)
            self.assertNotIn("private-backend-path", response.text)
        class Invalid:
            def get_forecast(self): raise ForecastError("Historical data must include ds and y columns.", 422)
        app = FastAPI(); app.include_router(create_forecast_router(Invalid()))
        with TestClient(app) as client:
            self.assertEqual(client.get("/api/analytics/forecast").status_code, 422)


if __name__ == "__main__": unittest.main()

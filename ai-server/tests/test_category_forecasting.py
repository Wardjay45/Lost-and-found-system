import unittest
import pandas as pd
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from analytics.routes import create_forecast_router
from analytics.category_forecasting import historical_source, evaluate_categories, METHODS, BASELINE


class CategoryForecastTests(unittest.TestCase):
    def test_api_sources_and_validation(self):
        app = FastAPI()
        app.include_router(create_forecast_router())
        with TestClient(app) as client, patch('analytics.routes.cached_categories', side_effect=lambda payload: {'categories': [], 'dataset': payload['dataset']}):
            response = client.get('/api/analytics/category-forecast?itemType=lost')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['cache-control'], 'no-store')
            self.assertEqual(response.json()['dataset']['total_records'], 126)
            self.assertEqual(client.get('/api/analytics/category-forecast?itemType=invalid').status_code, 422)
            response = client.post('/api/analytics/category-forecast', json={'historical': [], 'categories': ['Keys'], 'dataset': {'source': 'current'}})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['dataset']['source'], 'current')

    def test_uploaded_history_matches_colab(self):
        payload = historical_source('lost')
        self.assertEqual(len(payload['categories']), 7)
        self.assertEqual(len(payload['historical']), 29*7)
        self.assertEqual(sum(row['y'] for row in payload['historical']), 126)
        self.assertEqual(payload['dataset']['first_month'], '2024-06-01')
        self.assertEqual(payload['dataset']['last_month'], '2026-10-01')
        self.assertEqual(historical_source('found')['historical'], [])

    def test_selection_uses_only_validation_and_no_target_leakage(self):
        months = pd.date_range('2024-01-01', periods=20, freq='MS')
        payload = {'categories': ['Keys'], 'dataset': {}, 'historical': [
            {'category': 'Keys', 'ds': str(date.date()), 'y': index} for index, date in enumerate(months)]}
        def predictor(method, training):
            target = len(training)
            self.assertEqual(training.y.iloc[-1], target-1)
            # Prophet wins validation, ARIMA wins test. Selection must remain Prophet.
            value = target if (method == 'Prophet' and target < 14) or (method == 'ARIMA' and target >= 14) else target+2
            return float(value), []
        row = evaluate_categories(payload, predictor)['categories'][0]
        self.assertEqual(row['method'], 'Prophet')
        self.assertEqual(len(row['metrics']), 4)
        self.assertTrue(all('expected_reports' in metric for metric in row['metrics']))
        self.assertEqual(row['forecast_month'], '2025-09-01')
        self.assertEqual(row['metrics'][0]['validation_MAE'], 0)
        self.assertEqual(row['metrics'][0]['test_RMSE'], 2)

    def test_failed_models_are_visible_and_not_selected(self):
        payload = historical_source('lost')
        payload['categories'] = ['Keys']
        def predictor(method, training):
            if method == 'Prophet':
                raise RuntimeError('dependency unavailable')
            return 0., ['convergence warning'] if method == 'ARIMA' else []
        row = evaluate_categories(payload, predictor)['categories'][0]
        self.assertEqual(row['method'], 'Exponential Smoothing')
        self.assertEqual(row['metrics'][0]['status'], 'failed')
        self.assertEqual(row['metrics'][1]['status'], 'convergence_warning')

    def test_insufficient_history_does_not_fit(self):
        payload = {'categories': ['Keys'], 'historical': [], 'dataset': {}}
        row = evaluate_categories(payload, lambda *_: self.fail('must not fit'))['categories'][0]
        self.assertIsNone(row['expected_reports'])
        self.assertEqual(row['status'], 'insufficient_history')


if __name__ == '__main__':
    unittest.main()

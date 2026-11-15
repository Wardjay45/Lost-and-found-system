"""Category experiment matching the Colab expanding-window protocol."""
import hashlib
import json
import math
from pathlib import Path
from threading import Lock
import warnings

import numpy as np
import pandas as pd
from .forecasting import ForecastError, validate_monthly_history

METHODS = ('Prophet', 'ARIMA', 'Exponential Smoothing')
BASELINE = 'Previous-month baseline'
_cache = {}
_lock = Lock()


def predict_next(method, training):
    values = training['y'].to_numpy(dtype=float)
    next_date = training['ds'].iloc[-1] + pd.offsets.MonthBegin(1)
    notes = []
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter('always')
        if method == 'Prophet':
            from prophet import Prophet
            model = Prophet(yearly_seasonality=False, weekly_seasonality=False,
                            daily_seasonality=False, n_changepoints=min(5, len(training)-2),
                            uncertainty_samples=0)
            model.fit(training[['ds', 'y']], seed=42)
            value = model.predict(pd.DataFrame({'ds': [next_date]}))['yhat'].iloc[0]
        elif method == 'ARIMA':
            from statsmodels.tsa.arima.model import ARIMA
            model = ARIMA(values, order=(1, 1, 0), trend='t').fit()
            value = np.asarray(model.forecast(1))[0]
            if not model.mle_retvals.get('converged', True):
                notes.append('ARIMA convergence warning')
        elif method == 'Exponential Smoothing':
            from statsmodels.tsa.holtwinters import SimpleExpSmoothing
            model = SimpleExpSmoothing(values, initialization_method='estimated').fit(optimized=True)
            value = np.asarray(model.forecast(1))[0]
            if not getattr(model, 'mle_retvals', {}).get('success', True):
                notes.append('Exponential Smoothing convergence warning')
        elif method == BASELINE:
            value = values[-1]
        else:
            raise ValueError('Unknown forecasting method')
        notes.extend(str(w.message) for w in caught if 'converg' in str(w.message).lower())
    if not math.isfinite(float(value)):
        raise ValueError('Nonfinite forecast')
    return max(0., float(value)), sorted(set(notes))


def historical_source(item_type):
    if item_type not in ('lost', 'found'):
        raise ForecastError('Choose lost or found.', 422)
    # Only aggregate category/month counts are published; individual reports stay local.
    with Path(__file__).with_name('historical_category_monthly.json').open(encoding='utf-8') as source:
        return json.load(source)[item_type]



def evaluate_categories(payload, predictor=predict_next):
    frame = pd.DataFrame(payload['historical'], columns=['category', 'ds', 'y'])
    results = []
    for category in payload['categories']:
        subset = frame[frame['category'].eq(category)][['ds', 'y']]
        row = {'category': category, 'status': 'insufficient_history', 'method': None,
               'expected_reports': None, 'forecast_month': None, 'metrics': [], 'historical': [], 'notes': []}
        results.append(row)
        if len(subset) < 18:
            row['notes'] = ['At least 18 complete months are needed: initial training plus six validation and six test months.']
            continue
        history = validate_monthly_history(subset)
        if len(pd.date_range(history.ds.min(), history.ds.max(), freq='MS')) != len(history):
            raise ForecastError('Category history must contain consecutive complete months.', 422)
        row['historical'] = [{'ds': str(r.ds.date()), 'y': int(r.y)} for r in history.itertuples()]
        n = len(history)
        for method in (*METHODS, BASELINE):
            metric = {'method': method, 'status': 'ok', 'notes': [], 'predictions': []}
            row['metrics'].append(metric)
            try:
                for phase, indices in [('validation', range(n-12, n-6)), ('test', range(n-6, n))]:
                    errors = []
                    for index in indices:
                        value, notes = predictor(method, history.iloc[:index].copy())
                        metric['notes'].extend(notes)
                        actual = int(history.y.iloc[index])
                        errors.append(actual-value)
                        metric['predictions'].append({'phase': phase, 'ds': str(history.ds.iloc[index].date()), 'actual': actual, 'predicted': value})
                    metric[phase + '_MAE'] = float(np.abs(errors).mean())
                    metric[phase + '_RMSE'] = float(np.sqrt(np.square(errors).mean()))
                    # Fixed pre-phase training scales, never validation/test targets.
                    differences = np.diff(history.y.iloc[:indices.start].to_numpy(dtype=float))
                    absolute_scale = float(np.abs(differences).mean())
                    squared_scale = float(np.square(differences).mean())
                    metric[phase + '_MASE'] = (metric[phase + '_MAE'] / absolute_scale
                                               if absolute_scale > 0 else None)
                    metric[phase + '_RMSSE'] = (metric[phase + '_RMSE'] / math.sqrt(squared_scale)
                                                if squared_scale > 0 else None)
                    metric[phase + '_scale_note'] = ('Defined' if absolute_scale > 0
                                                       else 'N/A: constant training history')
                if metric['notes']:
                    metric['status'] = 'convergence_warning'
            except Exception as error:
                metric['status'] = 'failed'
                metric['notes'].append(str(error))
        candidates = [m for m in row['metrics'] if m['method'] in METHODS and m['status'] == 'ok']
        # Show a next-month forecast for every method, keeping validation
        # selection independent of both final refits and test scores.
        next_month = str((history.ds.iloc[-1]+pd.offsets.MonthBegin(1)).date())
        for metric in row['metrics']:
            if metric['status'] == 'failed':
                continue
            try:
                value, notes = predictor(metric['method'], history)
                metric.update(expected_reports=value, forecast_month=next_month,
                              forecast_status='ok' if not notes else 'convergence_warning',
                              forecast_notes=notes)
            except Exception as error:
                metric.update(expected_reports=None, forecast_month=next_month,
                              forecast_status='failed', forecast_notes=[str(error)])
        if not candidates:
            row['status'] = 'unavailable'
            row['notes'] = ['No method completed evaluation without errors or convergence warnings.']
            continue
        chosen = min(candidates, key=lambda m: (m['validation_MAE'], m['validation_RMSE'], m['method']))
        row['method'] = chosen['method']
        row.update(status=chosen['forecast_status'] if chosen['forecast_status'] != 'failed' else 'unavailable',
                   expected_reports=chosen['expected_reports'], forecast_month=next_month,
                   notes=chosen['forecast_notes'])
    return {'categories': results, 'dataset': payload['dataset'],
            'protocol': {'minimum_months': 18, 'validation_months': 6, 'test_months': 6,
                         'metrics': ['MAE', 'RMSE', 'MASE', 'RMSSE'],
                         'scaling': 'Lag 1; fixed training denominators before each phase; zero denominator returns null.',
                         'selection': 'Lowest validation MAE, then RMSE; test scores never select the method.'},
            'warnings': ['MAE and RMSE are errors in reports per month, not accuracy percentages.',
                         'MASE and RMSSE are scaled errors, not percentages; constant training histories return N/A.',
                         'Sparse zero-report periods can make selection uninformative. Compare test scores with the baseline.',
                         'Forecasts target the month after the last complete source month, which may not be the current month.']}


def cached_categories(payload):
    key = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    with _lock:
        if key not in _cache:
            result = evaluate_categories(payload)
            if len(_cache) >= 8:
                _cache.pop(next(iter(_cache)))
            _cache[key] = result
        return _cache[key]

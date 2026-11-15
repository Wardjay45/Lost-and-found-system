"""Run local forecasting without loading the image and text embedding models.

python -m uvicorn forecast_app:app --host 127.0.0.1 --port 8000
The full main:app also provides these routes; use one entry point per port.
"""
import hmac
import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from analytics.routes import create_forecast_router

app = FastAPI(title='Lost and Found Local Forecasting')
app.include_router(create_forecast_router())


@app.middleware('http')
async def service_access(request: Request, call_next):
    key = os.environ.get('AI_SERVICE_KEY', '')
    if request.url.path != '/health':
        if os.environ.get('VERCEL') and not key:
            return JSONResponse(status_code=503, content={'detail': 'AI service access is not configured'})
        if key and not hmac.compare_digest(request.headers.get('authorization', ''), 'Bearer ' + key):
            return JSONResponse(status_code=401, content={'detail': 'AI service access required'})
    return await call_next(request)


@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'local-forecasting',
            'methods': ['Prophet', 'ARIMA', 'Exponential Smoothing']}

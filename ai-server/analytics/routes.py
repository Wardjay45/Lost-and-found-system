import logging
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field
import pandas as pd
from .forecasting import ForecastError, ForecastService, MonthlyHistory, forecast_monthly


class ReportHistory(BaseModel):
    historical: list[dict] = Field(min_length=3, max_length=1200)
    dataset: dict

logger = logging.getLogger(__name__)


def create_forecast_router(service=None):
    router = APIRouter(prefix="/api/analytics", tags=["analytics"])
    forecasting = service if service is not None else ForecastService()

    @router.post("/forecast")
    def campus_forecast(body: ReportHistory, response: Response, timeframe: str = 'monthly'):
        response.headers["Cache-Control"] = "no-store"
        if timeframe not in ('weekly', 'monthly', 'yearly'):
            raise HTTPException(status_code=422, detail="Choose weekly, monthly or yearly.")
        if body.dataset.get('record_type') not in ('lost_items', 'found_items'):
            raise HTTPException(status_code=422, detail="Choose lost or found report history.")
        try:
            result = forecast_monthly(MonthlyHistory(pd.DataFrame(body.historical), body.dataset),
                                      horizon_months=12 if timeframe == 'yearly' else 1)
            if timeframe != 'monthly':
                result['model']['timeframe'] = timeframe
            return result
        except ForecastError as error:
            raise HTTPException(status_code=error.status_code, detail=str(error)) from error
        except Exception as error:
            logger.exception("Campus forecast failed")
            raise HTTPException(status_code=503, detail="The campus forecast could not be generated.") from error

    @router.get("/forecast")
    def forecast(response: Response, timeframe: str = 'monthly'):
        response.headers["Cache-Control"] = "no-store"
        try:
            return forecasting.get_forecast() if timeframe == 'monthly' else forecasting.get_forecast(timeframe)
        except ForecastError as error:
            raise HTTPException(status_code=error.status_code, detail=str(error)) from error
        except Exception as error:
            logger.exception("Monthly forecast failed")
            raise HTTPException(status_code=503, detail="The forecast could not be generated. Please try again later.") from error

    return router

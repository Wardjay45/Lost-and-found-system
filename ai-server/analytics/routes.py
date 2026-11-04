import logging
from fastapi import APIRouter, HTTPException, Response
from .forecasting import ForecastError, ForecastService

logger = logging.getLogger(__name__)


def create_forecast_router(service=None):
    router = APIRouter(prefix="/api/analytics", tags=["analytics"])
    forecasting = service if service is not None else ForecastService()

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

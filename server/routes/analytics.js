import { Router } from 'express';
import supabase from '../db.js';
import { createProductionAccess } from '../services/productionAccess.js';
import { aiFetch } from '../services/aiClient.js';
import { validateForecastResponse } from '../../shared/forecast.mjs';

export function createAnalyticsRouter({ client = supabase, jwtSecret, fetcher = aiFetch } = {}) {
  const router = Router();
  router.use(createProductionAccess(client, { ...(jwtSecret === undefined ? {} : { jwtSecret }) }));
  router.get('/forecast', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const timeframe = req.query.timeframe || 'monthly';
    if (!['weekly', 'monthly', 'yearly'].includes(timeframe)) return res.status(400).json({ error: 'Choose weekly, monthly or yearly.' });
    try {
      const base = (process.env.AI_SERVER_URL || 'http://localhost:8000').replace(/\/$/, '');
      const response = await fetcher(base + '/api/analytics/forecast' + (timeframe === 'monthly' ? '' : '?timeframe=' + timeframe), { signal: AbortSignal.timeout(120000) });
      if (response.status === 422) return res.status(422).json({ error: 'The historical forecast dataset is invalid or has fewer than three observed months.' });
      if (!response.ok) throw new Error('Forecast service unavailable');
      res.json(validateForecastResponse(await response.json(), { timeframe }));
    } catch {
      res.status(503).json({ error: 'Predictive analytics is unavailable. Check that the Python forecasting service is running with its forecasting dependencies.' });
    }
  });
  return router;
}

export default createAnalyticsRouter();

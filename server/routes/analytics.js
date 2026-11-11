import { Router } from 'express';
import supabase from '../db.js';
import { createProductionAccess } from '../services/productionAccess.js';
import { aiFetch } from '../services/aiClient.js';
import { validateForecastResponse } from '../../shared/forecast.mjs';
import { readAll } from '../services/readAll.js';
import { reportForecastHistory } from '../services/reportForecastHistory.js';

export function createAnalyticsRouter({ client = supabase, jwtSecret, fetcher = aiFetch } = {}) {
  const router = Router();
  router.use(createProductionAccess(client, { ...(jwtSecret === undefined ? {} : { jwtSecret }) }));
  router.get('/forecast', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const timeframe = req.query.timeframe || 'monthly';
    const source = req.query.source || 'sample';
    const itemType = req.query.itemType || 'found';
    if (!['campus', 'sample'].includes(source) || !['lost', 'found'].includes(itemType)) return res.status(400).json({ error: 'Choose a valid source and report type.' });
    if (source === 'sample' && itemType === 'lost') return res.status(422).json({ code: 'FORECAST_HISTORY_UNAVAILABLE', error: 'The UBC sample contains found-item records only. Lost-item history is not available in this dataset. Choose campus records to forecast your own lost reports when enough history is available.' });
    if (!['weekly', 'monthly', 'yearly'].includes(timeframe)) return res.status(400).json({ error: 'Choose weekly, monthly or yearly.' });
    try {
      const base = (process.env.AI_SERVER_URL || 'http://localhost:8000').replace(/\/$/, '');
      let options = { signal: AbortSignal.timeout(120000) };
      if (source === 'campus') {
        const dateColumn = itemType === 'lost' ? 'date_reported' : 'date_found';
        const rows = await readAll(client.from(`${itemType}_items`).select(`id,created_at:${dateColumn}`).order('id', { ascending: true }));
        const history = reportForecastHistory(rows, itemType);
        if (history.historical.length < 3) return res.status(422).json({ code: 'FORECAST_HISTORY_UNAVAILABLE', error: `Not enough campus ${itemType}-report history. At least three complete months after the first reporting month are required; ${history.historical.length} are currently available.` });
        options = { ...options, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(history) };
      }
      const response = await fetcher(base + '/api/analytics/forecast' + (timeframe === 'monthly' ? '' : '?timeframe=' + timeframe), options);
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

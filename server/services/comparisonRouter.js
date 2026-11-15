import { Router } from 'express';
import { aiFetch } from './aiClient.js';

export function createComparisonRouter(fetchAi = aiFetch) {
  const router = Router();
  const forward = async (req, res, path) => {
    try {
      const base = process.env.AI_SERVER_URL || 'http://localhost:8000';
      const response = await fetchAi(`${base}/comparison/${path}`, {
        method: req.method,
        ...(req.method === 'POST' ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req.body),
        } : {}),
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = typeof data.detail === 'string' ? data.detail : 'Check the query, candidates and correct-match labels.';
        return res.status(response.status).json({ error: detail });
      }
      return res.json(data);
    } catch {
      return res.status(503).json({ error: 'Model comparison is unavailable. Check that the AI server is running with the comparison models installed.' });
    }
  };
  router.get('/models', (req, res) => forward(req, res, 'models'));
  router.post('/run', (req, res) => forward(req, res, 'run'));
  return router;
}

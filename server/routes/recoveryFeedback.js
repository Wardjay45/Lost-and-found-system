import { Router } from 'express';
import { createRecoveryFeedbackService } from '../services/recoveryFeedback.js';
import { configuredRecoveryRepository } from '../services/recoveryRepository.js';

let service;
function configuredService() {
  if (!service) service = createRecoveryFeedbackService({ repository: configuredRecoveryRepository(), jwtSecret: process.env.JWT_SECRET });
  return service;
}

function handle(getService, role, action, status = 200) {
  return async (req, res) => {
    try {
      const api = getService();
      const actor = await api.authorize(req.headers.authorization?.replace(/^Bearer /, ''), role);
      res.status(status).json(await action(api, actor, req));
    } catch (error) {
      res.status(error.status || 503).json({ error: error.status ? error.message : 'Recovery feedback is unavailable. The administrator must finish server and database setup before trying again.', code: error.code && error.status ? error.code : 'RECOVERY_UNAVAILABLE' });
    }
  };
}

export function createRecoveryFeedbackRouter(getService = configuredService) {
  const router = Router();
  router.get('/recoveries', handle(getService, 'student', (api, actor) => api.mine(actor)));
  router.post('/', handle(getService, 'student', (api, actor, req) => api.submit(actor, req.body), 201));
  router.get('/summary', handle(getService, 'admin', api => api.summary()));
  router.get('/', handle(getService, 'admin', api => api.list()));
  return router;
}

export function createRecoveryClaimHandler(getService = configuredService) {
  return handle(getService, 'admin', (api, actor, req) => api.claim(actor, req.params.id, req.body));
}

export default createRecoveryFeedbackRouter();

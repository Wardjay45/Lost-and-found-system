import jwt from 'jsonwebtoken';

export function createProductionAccess(client, { jwtSecret = () => process.env.JWT_SECRET, mobileData = false } = {}) {
  return async (req, res, next) => {
    try {
      const secret = typeof jwtSecret === 'function' ? jwtSecret() : jwtSecret;
      if (!secret) return res.status(503).json({ error: 'Server sessions are not configured.' });
      const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
      let claims;
      try { claims = jwt.verify(token || '', secret, { algorithms: ['HS256'] }); }
      catch { return res.status(401).json({ error: 'Please sign in to continue.' }); }
      if (!Number.isSafeInteger(Number(claims.id)) || Number(claims.id) <= 0) return res.status(401).json({ error: 'Invalid session.' });
      const { data: user, error } = await client.from('users').select('id,name,role,status').eq('id', Number(claims.id)).maybeSingle();
      if (error) throw error;
      if (!user || user.status !== 'active' || user.role !== claims.role) return res.status(403).json({ error: 'This account cannot access the server.' });
      const readOnly = req.method === 'GET' && /^\/(categories|qr-locations)(\/|$)/.test(req.path);
      const mobileChanges = req.method === 'GET' && req.path.replace(/\/$/, '') === '/mobile/changes';
      const mobileService = mobileChanges || req.method === 'POST' && ['/ai/match', '/speech-to-text'].includes(req.path.replace(/\/$/, '')) || /^\/mobile\/data(?:\/|$)/.test(req.path);
      if (!['admin', 'superadmin'].includes(user.role) && !(user.role === 'student' && (readOnly || mobileService || mobileData))) return res.status(403).json({ error: 'Administrator access is required.' });
      req.actor = user; next();
    } catch { res.status(503).json({ error: 'Unable to verify this session. Please try again.' }); }
  };
}

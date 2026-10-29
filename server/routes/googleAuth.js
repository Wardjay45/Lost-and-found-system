import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import { createGoogleAuthService } from '../services/googleAuth.js';

export function createGoogleAuthRouter(getService = configuredService) {
  const router = Router();
  const handle = (method, status) => async (req, res) => {
    try {
      const result = await getService()[method](req.body);
      res.status(status).json(result);
    } catch (error) {
      res.status(error.status || 503).json({ error: error.status ? error.message : 'School Google sign-in is temporarily unavailable. Please try again.' });
    }
  };
  router.post('/google', handle('continueWithGoogle', 200));
  router.post('/google/signup', handle('completeSignup', 201));
  router.post('/signup', handle('completeSignup', 201));
  return router;
}

let service;
function configuredService() {
  if (!service) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
    const google = new OAuth2Client();
    service = createGoogleAuthService({
      client, verifyIdToken: options => google.verifyIdToken(options),
      clientId: process.env.GOOGLE_WEB_CLIENT_ID, jwtSecret: process.env.JWT_SECRET,
      allowedDomains: (process.env.SCHOOL_EMAIL_DOMAINS || 'dnsc.edu.ph').split(','),
    });
  }
  return service;
}

export default createGoogleAuthRouter();

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import supabase from './db.js';

import categoriesRouter from './routes/categories.js';
import usersRouter from './routes/users.js';
import lostItemsRouter from './routes/lostItems.js';
import foundItemsRouter from './routes/foundItems.js';
import authRouter from './routes/auth.js';
import googleAuthRouter from './routes/googleAuth.js';
import recoveryFeedbackRouter from './routes/recoveryFeedback.js';
import dashboardRouter from './routes/dashboard.js';
import messagesRouter from './routes/messages.js';
import { createNotificationRouter } from './services/notifications.js';
import activityLogsRouter from './routes/activityLogs.js';
import qrLocationsRouter from './routes/qrLocations.js';
import aiRouter from './routes/ai.js';
import speechToTextRouter from './routes/deepgram.js';
import settingsRouter from './routes/settings.js';
import { createProductionAccess } from './services/productionAccess.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const app = express();

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', googleAuthRouter);
app.use('/api/feedback', recoveryFeedbackRouter);
app.use('/api/auth', authRouter);
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
if (process.env.NODE_ENV === 'production' || process.env.VERCEL) app.use('/api', createProductionAccess(supabase));
app.use('/api/categories', categoriesRouter);
app.use('/api/users', usersRouter);
app.use('/api/lost-items', lostItemsRouter);
app.use('/api/found-items', foundItemsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/notifications', createNotificationRouter(supabase));
app.use('/api/activity-logs', activityLogsRouter);
app.use('/api/qr-locations', qrLocationsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/speech-to-text', speechToTextRouter);
app.use('/api/settings', settingsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});


export default app;

// Start server with public access info (works with mobile data via localtunnel)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';
import os from 'os';

import categoriesRouter from './routes/categories.js';
import usersRouter from './routes/users.js';
import lostItemsRouter from './routes/lostItems.js';
import foundItemsRouter from './routes/foundItems.js';
import authRouter from './routes/auth.js';
import googleAuthRouter from './routes/googleAuth.js';
import recoveryFeedbackRouter from './routes/recoveryFeedback.js';
import dashboardRouter from './routes/dashboard.js';
import messagesRouter from './routes/messages.js';
import supabase from './db.js';
import { createNotificationRouter } from './services/notifications.js';
import activityLogsRouter from './routes/activityLogs.js';
import qrLocationsRouter from './routes/qrLocations.js';
import aiRouter from './routes/ai.js';
import speechToTextRouter from './routes/deepgram.js';
import settingsRouter from './routes/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', googleAuthRouter);
app.use('/api/feedback', recoveryFeedbackRouter);
app.use('/api/auth', authRouter);
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Get local network IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        // Prefer Ethernet/Wi-Fi over virtual adapters
        if (!name.includes('Virtual') && !name.includes('VMware') && !name.includes('vEthernet')) {
          return iface.address;
        }
      }
    }
  }
  return '0.0.0.0';
}

// Start the Express server
app.listen(PORT, '0.0.0.0', async () => {
  const localIP = getLocalIP();

  console.log('============================================');
  console.log('  Lost & Found Server — RUNNING');
  console.log('============================================');
  console.log('');
  console.log('  ✅ Local:     http://localhost:' + PORT + '/api');
  console.log('  ✅ Network:   http://' + localIP + ':' + PORT + '/api');
  console.log('');
  console.log('============================================');
  console.log('  HOW TO CONNECT YOUR PHONE');
  console.log('============================================');
  console.log('');
  console.log('  📱 Same WiFi (EASIEST — DO THIS FIRST):');
  console.log('     Open the app → tap ⚙️ gear icon → enter:');
  console.log('     http://' + localIP + ':' + PORT + '/api');
  console.log('');
  console.log('  📱 Mobile Data / Different Network:');
  console.log('     Open a NEW terminal and run:');
  console.log('     npm run tunnel');
  console.log('     Then copy the public URL into the app.');
  console.log('');
  console.log('  Press Ctrl+C to stop.');
  console.log('============================================');

  // Try to start localtunnel for public access
  try {
    const localtunnel = (await import('localtunnel')).default;
    const tunnel = await localtunnel({ port: PORT });

    // Wait 2 seconds then auto-unlock the tunnel
    setTimeout(async () => {
      try {
        const unlockRes = await fetch(tunnel.url + '/api/health', {
          headers: { 'Bypass-Tunnel-Reminder': 'true' }
        });
        if (unlockRes.ok) {
          console.log('');
          console.log('============================================');
          console.log('  ✅ PUBLIC URL (any network, any device)');
          console.log('============================================');
          console.log('');
          console.log('  📱 ' + tunnel.url + '/api');
          console.log('');
          console.log('  Use this URL in the app ⚙️ settings.');
          console.log('  Works on WiFi, 4G, 5G — ANY internet!');
          console.log('');
          console.log('  ⚠️  If "Connection Failed":');
          console.log('  Open ' + tunnel.url + ' in a browser on');
          console.log('  your phone first, then try again.');
          console.log('============================================');
        }
      } catch (e) {
        console.log('');
        console.log('  ⚠️  Tunnel needs initial unlock.');
        console.log('  Open ' + tunnel.url + ' in any browser');
        console.log('  first, then the app will work.');
      }
    }, 2000);

  } catch (e) {
    // localtunnel failed — that's OK, local IP still works
  }
});

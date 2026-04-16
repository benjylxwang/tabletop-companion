import express from 'express';
import cors from 'cors';
import './lib/supabase.js';
import { authMiddleware } from './middleware/auth.js';
import { viewModeMiddleware } from './middleware/viewMode.js';
import { healthRouter } from './routes/health.js';
import { configRouter } from './routes/config.js';
import { aiRouter } from './routes/ai.js';
import { campaignsRouter } from './routes/campaigns.js';
import { charactersRouter } from './routes/characters.js';
import { factionsRouter } from './routes/factions.js';
import { invitationsRouter } from './routes/invitations.js';
import { locationsRouter } from './routes/locations.js';
import { loreRouter } from './routes/lore.js';
import { npcsRouter } from './routes/npcs.js';
import { sessionsRouter } from './routes/sessions.js';
import { uploadsRouter } from './routes/uploads.js';
import { meRouter } from './routes/me.js';
import { ensureUploadsBucket } from './lib/uploadsBucket.js';

const app = express();

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      try {
        const { hostname } = new URL(origin);
        if (hostname === 'localhost' || hostname === '127.0.0.1') return cb(null, true);
        if (/\.up\.railway\.app$/.test(hostname)) return cb(null, true);
        if (/\.railway\.app$/.test(hostname)) return cb(null, true);
      } catch {
        // fall through to block
      }
      cb(new Error(`CORS blocked: ${origin}`));
    },
  }),
);

app.use(express.json());
app.use(viewModeMiddleware);

app.use(healthRouter);
app.use(configRouter);

app.use('/api', authMiddleware, meRouter);
app.use('/api', authMiddleware, campaignsRouter);
app.use('/api', authMiddleware, charactersRouter);
app.use('/api', authMiddleware, factionsRouter);
app.use('/api', authMiddleware, invitationsRouter);
app.use('/api', authMiddleware, locationsRouter);
app.use('/api', authMiddleware, loreRouter);
app.use('/api', authMiddleware, npcsRouter);
app.use('/api', authMiddleware, sessionsRouter);
app.use('/api/ai', authMiddleware, aiRouter);
app.use('/api/uploads', authMiddleware, uploadsRouter);

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, async () => {
  console.log(`api listening on :${port}`);
  try {
    await ensureUploadsBucket();
  } catch (err) {
    console.error('failed to ensure uploads bucket on startup', err);
  }
});
server.keepAliveTimeout = 65_000;

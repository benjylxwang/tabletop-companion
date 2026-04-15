import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { campaignsRouter } from './routes/campaigns.js';

const { SUPABASE_URL, SUPABASE_ANON_KEY, PORT } = process.env;
console.log('Supabase config present:', {
  url: !!SUPABASE_URL,
  anonKey: !!SUPABASE_ANON_KEY,
});

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
app.use(healthRouter);
app.use(campaignsRouter);

const port = Number(PORT) || 3000;
app.listen(port, () => {
  console.log(`api listening on :${port}`);
});

// smoke test 2026-04-15T15:09:38Z

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import prisma          from './lib/prisma';
import authRouter       from './routes/auth';
import childrenRouter   from './routes/children';
import childRouter      from './routes/child';
import speechRouter     from './routes/speech';
import charactersRouter from './routes/characters';
import reportsRouter    from './routes/reports';

// ─── Boot-time guards ──────────────────────────────────────────────────────────
const APP_ENV = process.env.APP_ENV ?? 'development';
const DEV_BIOMETRIC_BYPASS = process.env.DEV_BIOMETRIC_BYPASS === 'true';

if (DEV_BIOMETRIC_BYPASS && APP_ENV === 'production') {
  console.error(
    '[BOOT GUARD] DEV_BIOMETRIC_BYPASS=true is not allowed when APP_ENV=production. Refusing to start.',
  );
  process.exit(1);
}

if (!process.env.WEBAUTHN_RP_ID || !process.env.WEBAUTHN_ORIGIN) {
  console.error(
    '[BOOT GUARD] WEBAUTHN_RP_ID and WEBAUTHN_ORIGIN must be set. Refusing to start.',
  );
  console.error('[BOOT GUARD] Copy server/.env.example to server/.env and set all required values.');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('[BOOT GUARD] JWT_SECRET must be set. Refusing to start.');
  console.error('[BOOT GUARD] Copy server/.env.example to server/.env and set all required values.');
  process.exit(1);
}

if (!process.env.DB_URL) {
  console.error('[BOOT GUARD] DB_URL must be set. Refusing to start.');
  console.error('[BOOT GUARD] Copy server/.env.example to server/.env and set all required values.');
  process.exit(1);
}

// ─── App setup ────────────────────────────────────────────────────────────────
const app = express();

const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', env: APP_ENV, ts: new Date().toISOString() });
});

app.use('/api/auth',       authRouter);
app.use('/api/children',   childrenRouter);
app.use('/api/child',      childRouter);
app.use('/api/speech',     speechRouter);
app.use('/api/characters', charactersRouter);
app.use('/api/reports',    reportsRouter);

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Start — verify DB then bind ─────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001);

async function startServer(): Promise<void> {
  // Verify DB connection before accepting requests
  try {
    await prisma.$connect();
    console.log('[server] DB connected OK');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[server] FATAL: Cannot connect to database — ${msg}`);
    console.error(`[server] DB_URL = ${process.env.DB_URL ? process.env.DB_URL.replace(/:([^:@]+)@/, ':***@') : '(not set)'}`);
    console.error('[server] Is PostgreSQL running? Did you run "npx prisma migrate deploy" in server/?');
    await prisma.$disconnect();
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`\n[server] ✓ Listening on http://localhost:${PORT}  (APP_ENV=${APP_ENV})`);
    console.log(`[server] ✓ DB connected, CORS origin: ${corsOrigin}`);
    if (DEV_BIOMETRIC_BYPASS) {
      console.warn('[server] DEV_BIOMETRIC_BYPASS is enabled — demo mode only.');
    }
    console.log('[server] Ready — press Ctrl+C to stop.\n');
  });
}

startServer();

export default app;

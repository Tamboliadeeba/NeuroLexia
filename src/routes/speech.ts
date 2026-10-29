import { Router } from 'express';

const router = Router();

// ── GET /api/speech/token — stub (Azure proxy is STRETCH) ────────────────────
router.get('/token', (_req, res): void => {
  res.status(501).json({ error: 'Speech token not implemented (STRETCH)' });
});

// ── POST /api/speech/tts — stub ───────────────────────────────────────────────
router.post('/tts', (_req, res): void => {
  res.status(501).json({ error: 'TTS proxy not implemented (STRETCH)' });
});

export default router;

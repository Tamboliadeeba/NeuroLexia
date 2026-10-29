import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// ── GET /api/characters ───────────────────────────────────────────────────────
// Public — no auth required; the child portal needs this for CharacterSelect.
router.get('/', async (_req, res): Promise<void> => {
  const characters = await prisma.character.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      model_key: true,
      fallback_svg: true,
      description_en: true,
      description_hi: true,
    },
    orderBy: { name: 'asc' },
  });
  res.json(characters);
});

export default router;

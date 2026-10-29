/**
 * prisma/seed-demo.ts — Seed demo child with realistic game data.
 *
 * Requires an existing parent account created by seed-demo-parent.ts.
 * Run order: npm run seed:demo-parent  then  npm run seed:demo
 *
 * Re-runnable / idempotent — if a demo child already exists under
 * demo.parent@neurolexia.app it exits cleanly.
 *
 * Run: npm run seed:demo  (from server/)
 */

import { PrismaClient } from '@prisma/client';
import { seedDemoChild } from '../src/lib/seedDemoChild';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo.parent@neurolexia.app';

async function main() {
  const parent = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    select: { id: true, preferred_language: true },
  });

  if (!parent) {
    console.error(`[seed-demo] Demo parent not found (email=${DEMO_EMAIL}).`);
    console.error('[seed-demo] Run npm run seed:demo-parent first.');
    process.exit(1);
  }

  const lang = parent.preferred_language;
  const result = await seedDemoChild(prisma, parent.id, lang);

  if (result.alreadyExisted) {
    console.log(`[seed-demo] Demo child already exists (id=${result.childId}). Nothing to do.`);
  } else {
    console.log(`[seed-demo] Created demo child with 4 weeks of sessions (id=${result.childId}).`);
  }
  console.log('[seed-demo] Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

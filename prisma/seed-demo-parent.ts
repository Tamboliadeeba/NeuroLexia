/**
 * prisma/seed-demo-parent.ts — Idempotent demo parent + child seed.
 *
 * Creates (or leaves untouched if already present):
 *   Parent : demo.parent@neurolexia.app  /  Demo@1234  /  "Demo Parent"
 *   Child  : Aarav, age 7, language=en, font=opendyslexic
 *
 * Safe to run multiple times. Existing records are never overwritten.
 * Run: npm run seed:demo-parent  (from server/)
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_EMAIL    = 'demo.parent@neurolexia.app';
const DEMO_PASSWORD = 'Demo@1234';
const DEMO_NAME     = 'Demo Parent';

async function main() {
  // ── Parent account ────────────────────────────────────────────────────────
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    select: { id: true, name: true },
  });

  let parentId: string;

  if (existing) {
    parentId = existing.id;
    console.log(`[seed-demo-parent] Parent already exists (id=${parentId}). Skipping upsert.`);
  } else {
    const password_hash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const user = await prisma.user.create({
      data: {
        name: DEMO_NAME,
        email: DEMO_EMAIL,
        password_hash,
        preferred_language: 'en',
        consent_given_at: new Date(),
      },
      select: { id: true },
    });
    parentId = user.id;
    console.log(`[seed-demo-parent] Created demo parent (id=${parentId}).`);
  }

  // ── Demo child ────────────────────────────────────────────────────────────
  const childExists = await prisma.child.findFirst({
    where: { parent_id: parentId, name: 'Aarav' },
    select: { id: true },
  });

  if (childExists) {
    console.log(`[seed-demo-parent] Demo child already exists (id=${childExists.id}). Skipping.`);
  } else {
    const child = await prisma.child.create({
      data: {
        parent_id: parentId,
        name: 'Aarav',
        age: 7,
        preferred_language: 'en',
        preferred_font: 'opendyslexic',
        is_demo: true,
      },
      select: { id: true },
    });
    console.log(`[seed-demo-parent] Created demo child Aarav (id=${child.id}).`);
  }

  console.log('[seed-demo-parent] Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

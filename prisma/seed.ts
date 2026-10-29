/**
 * prisma/seed.ts — Characters seed.
 *
 * Exactly two characters: astro (Astro) and nova (Nova).
 * Any character whose key is NOT in this list is automatically removed;
 * children pointing at a removed character have character_id set to NULL
 * so they see CharacterSelect again on next login.
 *
 * Re-runnable / idempotent — uses upsert; safe to run multiple times.
 *
 * Run: npm run db:seed  (from server/)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** The two canonical characters. */
const characters = [
  {
    key: 'astro',
    name: 'Astro',
    model_key: 'astro',
    tts_voice_hint: 'en-US-friendly',
    description_en: 'Astro is a friendly astronaut exploring space in a chunky white suit with orange and teal accents! Big round helmet with a glossy gold-tinted visor, small backpack, and a kind smile — ready for any adventure.',
    description_hi: 'एस्ट्रो एक दोस्ताना अंतरिक्षयात्री है! नारंगी और तील एक्सेंट वाला मोटा सफेद सूट, चमकदार सुनहरे वाइज़र वाला बड़ा गोल हेलमेट, और एक प्यारी मुस्कान — हर रोमांच के लिए तैयार।',
    fallback_svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" width="80" height="80" aria-label="Astro the astronaut character">
  <defs>
    <radialGradient id="as-suit" cx="40%" cy="25%" r="65%"><stop offset="0%" stop-color="#f0f4f8"/><stop offset="100%" stop-color="#c8d4e0"/></radialGradient>
    <radialGradient id="as-visor" cx="40%" cy="30%" r="60%"><stop offset="0%" stop-color="#e8c060"/><stop offset="100%" stop-color="#b08030"/></radialGradient>
  </defs>
  <ellipse cx="40" cy="56" rx="20" ry="16" fill="url(#as-suit)"/>
  <rect x="28" y="46" width="24" height="18" rx="5" fill="#d4dbe5"/>
  <circle cx="35" cy="52" r="3" fill="#ff4444" opacity="0.9"/>
  <circle cx="42" cy="52" r="3" fill="#44ccee" opacity="0.9"/>
  <rect x="20" y="44" width="10" height="18" rx="4" fill="#c8d4e0"/>
  <ellipse cx="16" cy="54" rx="5" ry="10" fill="url(#as-suit)"/>
  <ellipse cx="64" cy="54" rx="5" ry="10" fill="url(#as-suit)"/>
  <circle cx="16" cy="62" r="5" fill="#ff7b1a"/>
  <circle cx="64" cy="62" r="5" fill="#ff7b1a"/>
  <ellipse cx="32" cy="70" rx="7" ry="8" fill="url(#as-suit)"/>
  <ellipse cx="48" cy="70" rx="7" ry="8" fill="url(#as-suit)"/>
  <ellipse cx="32" cy="76" rx="7" ry="5" fill="#ff7b1a"/>
  <ellipse cx="48" cy="76" rx="7" ry="5" fill="#ff7b1a"/>
  <circle cx="40" cy="28" r="22" fill="url(#as-suit)"/>
  <ellipse cx="40" cy="30" rx="15" ry="12" fill="url(#as-visor)" opacity="0.75"/>
  <circle cx="35" cy="27" r="4" fill="#fff"/><circle cx="45" cy="27" r="4" fill="#fff"/>
  <circle cx="36" cy="27" r="2.2" fill="#1a2a4a"/><circle cx="46" cy="27" r="2.2" fill="#1a2a4a"/>
  <circle cx="36.5" cy="26" r="0.9" fill="#fff" opacity="0.8"/><circle cx="46.5" cy="26" r="0.9" fill="#fff" opacity="0.8"/>
  <path d="M35 34 Q40 38 45 34" stroke="#1a2a4a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <circle cx="40" cy="30" r="16" fill="none" stroke="#ff7b1a" stroke-width="2.5"/>
  <ellipse cx="40" cy="46" rx="16" ry="5" fill="#d4dbe5"/>
</svg>`,
  },
  {
    key: 'nova',
    name: 'Nova',
    model_key: 'nova',
    tts_voice_hint: 'en-US-friendly',
    description_en: 'Nova is an original space hero with a silver-and-teal suit, a glowing starburst emblem, a flowing purple cape, and a star-gold belt. Kind eyes behind a teal visor — always ready to shine!',
    description_hi: 'नोवा एक असली अंतरिक्ष नायक है! चांदी-तील सूट, चमकता स्टारबर्स्ट एम्ब्लेम, बहती बैंगनी केप, और स्टार-सोने की बेल्ट। तील वाइज़र के पीछे दयालु आंखें — हमेशा चमकने के लिए तैयार!',
    fallback_svg: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" width="80" height="80" aria-label="Nova the space hero character">
  <defs>
    <radialGradient id="nv-suit" cx="40%" cy="25%" r="65%"><stop offset="0%" stop-color="#c8d8e4"/><stop offset="100%" stop-color="#88a0b0"/></radialGradient>
    <radialGradient id="nv-helm" cx="40%" cy="30%" r="60%"><stop offset="0%" stop-color="#d8e8f0"/><stop offset="100%" stop-color="#9ab8cc"/></radialGradient>
  </defs>
  <!-- Cape (behind body) -->
  <path d="M22 44 Q14 60 20 72 Q32 68 40 66 Q48 68 60 72 Q66 60 58 44 Z" fill="#7c3aed" opacity="0.85"/>
  <!-- Body -->
  <ellipse cx="40" cy="54" rx="18" ry="14" fill="url(#nv-suit)"/>
  <!-- Teal chest stripe -->
  <rect x="30" y="46" width="20" height="12" rx="4" fill="#0d9488" opacity="0.9"/>
  <!-- Starburst emblem (8-point) -->
  <polygon points="40,48 41.5,51.5 45,51.5 42.5,54 43.5,57.5 40,55.5 36.5,57.5 37.5,54 35,51.5 38.5,51.5" fill="#ffd700"/>
  <!-- Belt -->
  <ellipse cx="40" cy="62" rx="17" ry="3.5" fill="#ffd700" opacity="0.9"/>
  <rect x="36" y="60" width="8" height="4" rx="2" fill="#e6a000"/>
  <!-- Arms -->
  <ellipse cx="18" cy="52" rx="5" ry="9" fill="url(#nv-suit)"/>
  <ellipse cx="62" cy="52" rx="5" ry="9" fill="url(#nv-suit)"/>
  <circle cx="18" cy="60" r="5" fill="#0d9488"/>
  <circle cx="62" cy="60" r="5" fill="#0d9488"/>
  <!-- Legs -->
  <ellipse cx="33" cy="68" rx="7" ry="8" fill="url(#nv-suit)"/>
  <ellipse cx="47" cy="68" rx="7" ry="8" fill="url(#nv-suit)"/>
  <ellipse cx="33" cy="75" rx="7" ry="5" fill="#0d9488"/>
  <ellipse cx="47" cy="75" rx="7" ry="5" fill="#0d9488"/>
  <!-- Head + helmet -->
  <circle cx="40" cy="26" r="20" fill="url(#nv-helm)"/>
  <!-- Teal visor slit -->
  <rect x="26" y="25" width="28" height="8" rx="4" fill="#00e5cc" opacity="0.75"/>
  <!-- Eyes (visible through visor) -->
  <circle cx="34" cy="27" r="3.5" fill="#fff"/><circle cx="46" cy="27" r="3.5" fill="#fff"/>
  <circle cx="34.8" cy="27" r="2" fill="#0a1e1a"/><circle cx="46.8" cy="27" r="2" fill="#0a1e1a"/>
  <circle cx="35.2" cy="26.2" r="0.8" fill="#fff" opacity="0.8"/><circle cx="47.2" cy="26.2" r="0.8" fill="#fff" opacity="0.8"/>
  <!-- Smile -->
  <path d="M35 33 Q40 37 45 33" stroke="#1a2a3a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <!-- Helmet teal accent ring -->
  <circle cx="40" cy="26" r="20" fill="none" stroke="#0d9488" stroke-width="2"/>
  <!-- Neck ring -->
  <ellipse cx="40" cy="44" rx="15" ry="4.5" fill="#b8c8d4"/>
  <!-- Top light -->
  <circle cx="40" cy="8" r="2.5" fill="#00e5cc" opacity="0.95"/>
</svg>`,
  },
];

async function main() {
  console.log('Seeding characters (astro + nova only)...');

  const keepKeys = characters.map((c) => c.key);

  // 1. Delete every character whose key is NOT in the keep list,
  //    first NULLing out children that point at them.
  const staleChars = await prisma.character.findMany({
    where: { key: { notIn: keepKeys } },
    select: { id: true, key: true },
  });

  if (staleChars.length > 0) {
    const staleIds = staleChars.map((c) => c.id);
    const nulled = await prisma.child.updateMany({
      where: { character_id: { in: staleIds } },
      data: { character_id: null },
    });
    if (nulled.count > 0) {
      console.log(`  Cleared character_id on ${nulled.count} child(ren) (was pointing at a stale character).`);
    }
    await prisma.character.deleteMany({ where: { key: { notIn: keepKeys } } });
    console.log(`  Deleted ${staleChars.length} stale character(s): ${staleChars.map((c) => c.key).join(', ')}`);
  }

  // 2. Upsert the two canonical characters
  for (const char of characters) {
    await prisma.character.upsert({
      where: { key: char.key },
      update: char,
      create: char,
    });
    console.log(`  Upserted: ${char.name} (${char.key})`);
  }

  console.log(`Seed complete. Characters table now contains: ${keepKeys.join(', ')}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

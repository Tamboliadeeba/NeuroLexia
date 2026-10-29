# NeuroLexia — Gamified Space-Themed Learning Platform for Dyslexic Children

## Top-Level Overview

**Goal:** Build NeuroLexia, a bilingual (English/Hindi) web application with two portals:
- **Child Portal** — a space/galaxy-themed, dyslexia-friendly game hub where children engage in 5 supportive practice games guided by a chosen character, authenticated via WebAuthn biometrics.
- **Parent Portal** — a credential-based dashboard where parents manage child profiles, view progress, and receive IBM watsonx.ai-generated reports on their child's learning behavior.

**Approach:** React (Vite) frontend, Node.js/Express backend, PostgreSQL database, IBM watsonx.ai for AI reports, Web Speech API + Azure Cognitive Services for speech I/O (keys never exposed to the client), WebAuthn for biometrics, i18next for UI strings (game content in `client/src/content/`), npm workspaces monorepo. Scoped into MVP (Phases 0–7, then 8–14, then Phase 15 Deploy) and STRETCH enhancements.

**Non-goals (MVP):** Native mobile app, third-party LMS integration, multi-teacher accounts, video recording of sessions, Azure TTS/STT fallback, full multi-level Astrotales.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   React (Vite) SPA                   │
│  ┌─────────────────────┐  ┌────────────────────────┐ │
│  │   Child Portal       │  │   Parent Portal         │ │
│  │  (WebAuthn login)    │  │  (JWT credential login) │ │
│  └─────────────────────┘  └────────────────────────┘ │
└──────────────────────────┬──────────────────────────┘
                           │ REST
┌──────────────────────────▼──────────────────────────┐
│              Node.js / Express API                   │
│  Auth │ Profiles │ Sessions │ AI Reports             │
└──────────────────┬───────────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │   PostgreSQL (DB)   │
        └─────────────────────┘
                   │
        ┌──────────▼──────────┐
        │  IBM watsonx.ai     │
        │  (report generation)│
        └─────────────────────┘
```

---

## Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| Frontend framework | React 18 + Vite | Fast HMR, rich ecosystem, WebAuthn browser APIs |
| Styling | Tailwind CSS + custom CSS vars | Rapid dyslexia-friendly theming, dark space palette |
| Font | OpenDyslexic (primary), Atkinson Hyperlegible (fallback) | Dyslexia-specific legibility |
| State management | Zustand | Lightweight, no boilerplate |
| Routing | React Router v6 | Standard SPA routing |
| i18n | i18next + react-i18next | JSON namespace files per language |
| Animations | Framer Motion | Space animations, character entrance/exit |
| Backend | Node.js 20 + Express 5 | Familiar, fast to scaffold |
| Auth — biometric | WebAuthn (SimpleWebAuthn library, server + client) | W3C standard, no native app required |
| Auth — parent | JWT (jsonwebtoken) + bcrypt | Standard credential flow |
| Database | PostgreSQL 16 | Relational, strong JSON support for game data |
| ORM | Prisma | Type-safe schema, migrations |
| Speech-to-Text | Web Speech API (browser, free) + Azure Speech SDK fallback (STRETCH) | Web Speech API covers English well; Azure adds robust Hindi |
| Text-to-Speech | Web Speech API SpeechSynthesis + Azure TTS fallback (STRETCH) | Hindi neural voices in Azure |
| AI Reports | IBM watsonx.ai (REST / `@ibm-cloud/watsonx-ai`) | Required by brief; prefer chat endpoint |
| Charts | Recharts | React-native, accessible |
| File storage | CSS gradients / SVG (planets); SVG/emoji placeholders (characters) | No PNG assets exist; drawn in code |
| Deployment | Vercel (frontend) + Railway / Render (backend + DB) | Free tier, hackathon-suitable |

---

## Folder Structure

```
neurolexia/                        # npm workspaces root (package.json with "workspaces": ["client","server","shared"])
├── package.json                   # workspace root
├── client/                        # React + Vite SPA
│   ├── public/
│   │   └── fonts/                 # OpenDyslexic, Atkinson Hyperlegible, Noto Sans Devanagari woff2
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                # Route tree, i18n provider, theme provider
│   │   ├── i18n/
│   │   │   ├── en/                # English UI namespaces (NO game content)
│   │   │   │   ├── common.json
│   │   │   │   ├── child.json
│   │   │   │   └── parent.json
│   │   │   └── hi/                # Hindi UI namespaces (NO game content)
│   │   │       ├── common.json
│   │   │       ├── child.json
│   │   │       └── parent.json
│   │   ├── content/               # Structured game content (NOT i18next)
│   │   │   ├── en/
│   │   │   │   ├── echo_galaxy.json
│   │   │   │   ├── word_orbit.json
│   │   │   │   ├── astrotales.json
│   │   │   │   └── math_mission.json
│   │   │   └── hi/
│   │   │       ├── echo_galaxy.json
│   │   │       ├── word_orbit.json
│   │   │       ├── astrotales.json
│   │   │       └── math_mission.json
│   │   ├── components/
│   │   │   ├── common/            # LanguageToggle, Button, Modal, StarBackground
│   │   │   ├── child/             # CharacterGuide, BiometricLogin, GameCard, UnlockShop
│   │   │   └── parent/            # Sidebar, ProgressChart, ReportCard
│   │   ├── pages/
│   │   │   ├── child/
│   │   │   │   ├── ChildLogin.tsx
│   │   │   │   ├── CharacterSelect.tsx
│   │   │   │   ├── ChildDashboard.tsx
│   │   │   │   └── games/
│   │   │   │       ├── TripToSpace.tsx
│   │   │   │       ├── EchoGalaxy.tsx
│   │   │   │       ├── Astrotales.tsx
│   │   │   │       ├── WordOrbit.tsx
│   │   │   │       └── MathMission.tsx
│   │   │   └── parent/
│   │   │       ├── ParentLogin.tsx
│   │   │       ├── ParentRegister.tsx
│   │   │       ├── ParentDashboard.tsx
│   │   │       ├── ChildProfile.tsx
│   │   │       └── Reports.tsx
│   │   ├── hooks/
│   │   │   ├── useSpeechSynthesis.ts
│   │   │   ├── useSpeechRecognition.ts
│   │   │   └── useWebAuthn.ts
│   │   ├── store/
│   │   │   ├── authStore.ts
│   │   │   ├── childStore.ts
│   │   │   └── gameStore.ts
│   │   ├── services/
│   │   │   ├── api.ts             # Axios instance with JWT interceptors + retry queue
│   │   │   ├── speechService.ts   # TTS + STT abstraction
│   │   │   └── webauthnService.ts
│   │   ├── lib/
│   │   │   └── matchingUtils.ts   # Re-export from shared/; runs in browser
│   │   └── styles/
│   │       ├── globals.css        # CSS vars: space palette, font themes
│   │       └── dyslexia.css       # Font-size, letter-spacing, line-height rules
│   └── vite.config.ts             # path alias: @shared → ../../shared
│
├── shared/                        # npm workspace; code shared between client and server
│   ├── package.json
│   ├── tsconfig.json
│   └── matchingUtils.ts           # Canonical matching source; NFC normalisation + grapheme Levenshtein
│
├── server/                        # Node.js + Express API
│   ├── src/
│   │   ├── index.ts               # App entry, middleware, boot guards
│   │   ├── routes/
│   │   │   ├── auth.ts            # Parent credential + child WebAuthn + demo login
│   │   │   ├── children.ts        # Child profile CRUD (parent-scoped)
│   │   │   ├── child.ts           # Child-scoped routes (requireChild / requirePendingChild)
│   │   │   ├── sessions.ts        # POST /api/child/sessions
│   │   │   ├── unlocks.ts         # POST /api/child/unlocks
│   │   │   └── reports.ts         # AI report trigger + retrieval
│   │   ├── controllers/           # Business logic per route
│   │   ├── middleware/
│   │   │   ├── authMiddleware.ts  # JWT verification, requireParent/requireChild/requirePendingChild
│   │   │   └── rateLimiter.ts
│   │   ├── services/
│   │   │   ├── webauthnService.ts # SimpleWebAuthn server helpers
│   │   │   ├── watsonxService.ts  # IBM watsonx.ai REST calls
│   │   │   └── reportBuilder.ts  # Aggregates game_sessions → prompt
│   │   └── lib/
│   │       ├── pointsFormula.ts   # Points computation (server-side only)
│   │       └── pointCosts.ts      # Unlock cost table (server-side only)
│   ├── prisma/
│   │   ├── schema.prisma          # Full DB schema (canonical location)
│   │   ├── seed.ts                # Characters seed (single seed file)
│   │   └── seed-demo.ts           # Demo data seed
│   └── .env                       # DB URL, JWT secret, IBM API keys, Azure keys
│
├── CONTENT_REVIEW.md              # Every Hindi string/file requiring native-speaker review
└── README.md
```

---

## Database Schema

### `users` (parents)
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| email | TEXT UNIQUE | |
| password_hash | TEXT | bcrypt |
| name | TEXT | |
| preferred_language | ENUM('en','hi') | |
| override_pin_hash | TEXT NULLABLE | bcrypt-hashed PIN for parent/teacher override in Echo Galaxy |
| consent_given_at | TIMESTAMPTZ NULLABLE | set at registration; NULL = not consented (basic consent mechanism, not full legal compliance) |
| created_at | TIMESTAMPTZ | |

### `children`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| parent_id | UUID FK → users | |
| name | TEXT | |
| age | INT | |
| username | TEXT UNIQUE NULLABLE | optional username for child login tile (not email) |
| password_hash | TEXT NULLABLE | optional bcrypt hash; only set if parent enables password step; **stored by server after hashing — never accept a hash from the client** |
| preferred_language | ENUM('en','hi') | |
| character_id | UUID FK → characters NULLABLE | set by the child via PATCH /api/child/me (child token only); NULL until the child chooses in the child portal (Phase 2); parents cannot set this field; pre-login screens use the first seeded character as a visual default |
| preferred_font | ENUM('opendyslexic','atkinson','default') DEFAULT 'opendyslexic' | child's font choice |
| total_points | INT DEFAULT 0 | lifetime earned total (never decremented); used for progress charts |
| points_balance | INT DEFAULT 0 | spendable balance; incremented on session earn, decremented on unlock purchase |
| is_demo | BOOLEAN DEFAULT false | flag for demo bypass login |
| created_at | TIMESTAMPTZ | |

### `child_credentials` (WebAuthn)
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| child_id | UUID FK → children | Cascade delete |
| credential_id | BYTEA UNIQUE | WebAuthn credential ID (unique constraint) |
| public_key | BYTEA | COSE public key |
| counter | BIGINT | replay-attack counter |
| transports | TEXT[] | e.g. ['internal'] |
| created_at | TIMESTAMPTZ | |

### `characters`
Config-driven via `prisma/seed.ts`. Characters are **procedural 3D models** built in Three.js (no PNG/GLB files required). A `fallback_svg` flat SVG illustration is stored per character and shown when WebGL is unavailable. No emojis in any character data.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | TEXT | display name |
| key | TEXT UNIQUE | machine key |
| model_key | TEXT | maps to the procedural 3D model (equals key; may diverge for GLB overrides) |
| fallback_svg | TEXT | flat SVG illustration, shown when WebGL is unavailable |
| tts_voice_hint | TEXT | voice preference hint |
| description_en | TEXT | short bio (English) |
| description_hi | TEXT | short bio (Hindi) |

**Seed — 2 characters:**
| Key | Name | Concept |
|---|---|---|
| `astronaut` | Astro | Friendly chibi astronaut: white suit, glass helmet with glowing visor, backpack tanks, blinking chest lights, orange accents |
| `comet` | Comet | Cute space puppy: floppy ears, glass helmet, orange harness, wagging tail, glowing star tag |

### Session Definition & Per-Game Accuracy

A **session** is one completed level attempt — a child starts a level, plays it to completion (win or natural end), and the result is submitted via `POST /api/child/sessions`. Abandoned levels are not submitted.

**Verified accuracy per game** (self-reported and PIN-override attempts are always excluded):
| Game | Verified Accuracy Formula |
|---|---|
| Trip to Space | `valid_moves / total_moves` |
| Echo Galaxy | `verified_correct / verified_attempts` |
| Astrotales | `verified_correct / verified_attempts` |
| Word Orbit | `words_solved_on_first_submit / words_presented` |
| Math Mission | `correct_answers / questions_answered` |

`accuracy` is NULL when `verified_attempts == 0` (all self-reported session).

### `game_sessions`
The `scores` table is merged into `game_sessions`. All accuracy, attempt, and error data lives here.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| child_id | UUID FK → children | Cascade delete |
| game_type | ENUM | trip_to_space, echo_galaxy, astrotales, word_orbit, math_mission |
| client_session_id | UUID | client-generated UUID for idempotent submit; duplicate submits are ignored |
| started_at | TIMESTAMPTZ | |
| ended_at | TIMESTAMPTZ | |
| level | INT | difficulty level reached |
| score | INT | raw score |
| points_earned | INT | space points awarded (computed server-side) |
| accuracy | FLOAT NULLABLE | 0–1; NULL when all attempts are self-reported (no verified attempts) |
| attempts | INT | total attempts in the session |
| errors | JSONB | per-error-type counts (phoneme categories, override count, match_method, self_reported count) |
| self_reported_count | INT DEFAULT 0 | attempts logged via "I said it!" or PIN override; excluded from accuracy calculation |
| metadata | JSONB | game-specific detail (moves, hints, replay counts — never raw audio) |
| UNIQUE | (child_id, client_session_id) | idempotency scoped per child; not globally unique |

### `child_game_progress`
Tracks each child's current level and phase per game. Read on game start; updated in the same transaction as `game_sessions`.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| child_id | UUID FK → children | Cascade delete |
| game_type | ENUM | same enum as game_sessions |
| current_level | INT DEFAULT 1 | |
| phase | INT DEFAULT 1 | for Echo Galaxy: which content phase (aksharas/letters → words etc.) |
| updated_at | TIMESTAMPTZ | |
| UNIQUE | (child_id, game_type) | one row per child per game |

### `unlocks`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| child_id | UUID FK → children | Cascade delete |
| unlock_type | ENUM('planet','theme') | |
| unlock_key | TEXT | e.g. "mars", "aurora" |
| unlocked_at | TIMESTAMPTZ | |
| UNIQUE | (child_id, unlock_key) | prevents duplicate unlock rows |

### `ai_reports`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| child_id | UUID FK → children | Cascade delete |
| generated_at | TIMESTAMPTZ | |
| period_start | DATE | |
| period_end | DATE | |
| language | ENUM('en','hi') | language report was generated in |
| report_text | TEXT | raw watsonx.ai output |
| summary | TEXT NULLABLE | parsed SUMMARY section |
| weak_areas | TEXT NULLABLE | parsed WEAK_AREAS section |
| activities | TEXT NULLABLE | parsed ACTIVITIES section |
| prompt_used | TEXT | stored for audit |
| is_mock | BOOLEAN DEFAULT false | true when watsonx was unavailable or WATSONX_MOCK=true |
| model_id | TEXT NULLABLE | model used to generate this report |

---

## Per-Game Logic & Difficulty Progression

### Game 1 — Trip to Space
- **Mechanic:** Grid-based maze. The guide character is "stuck" at the goal cell; child navigates the player token to rescue them using four directional controls.
- **Level 1–3:** 4×4 grid, 1 obstacle row. **All four directions (up/down/left/right) are required from Level 1.** Before the first move, the guide plays a spoken tutorial ("Press the arrow that points UP to move up the galaxy!") and each arrow button is labelled (UP ↑, DOWN ↓, LEFT ←, RIGHT →) in the active language.
- **Level 4–6:** 6×6 grid, multiple obstacles.
- **Level 7+:** 8×8 grid, moving obstacles. Obstacles move **turn-based** — they advance one step only after the child makes a move (not in real-time). **No visible timer or time pressure at any level.** Completion time is recorded silently in session metadata for parent reports only.
- **Move narration:** After every valid move the guide speaks the direction taken: "You went LEFT", "You went UP", etc. in the active language.
- **Error feedback:** Guide speaks "Oops, I can't go there, try again!" in active language. A 🔊 replay button on every screen lets the child re-hear the last instruction.
- **On rescue:** Guide plays a celebration audio line; child sees a win animation.
- **Session data logged:** total moves, wrong moves, `completion_time_ms` (silent, never shown to child), tutorial replays per level.

### Game 2 — Echo Galaxy
- **Mechanic:** Guide says a **letter name** or **whole word** via TTS; child repeats; system checks. Items are not isolated phonemes — the guide says "bee" for "b", "cat" for the word cat.
- **Letter confusables:** All letter items have `confusable[]` entries for dyslexia-relevant pairs. Example confusable pairs: B (`b_d_swap`, `b_p_swap`), C/K (`c_k_swap`), D (`b_d_swap`), I/E (`i_e_swap`), M/N (`m_n_swap`), W/V (`w_v_swap`), P/Q (`p_q_swap`). These produce `phoneme_category` error codes just like word items and feed into the AI report.
- **Minimal-pair word items:** Each word has a `confusable[]` list. If the STT transcript matches a confusable instead of the target, a specific error category is logged (e.g. `i_e_swap` for "pin"→"pen", `c_k_swap` for "cat"→"kat"). Error categories feed directly into the AI report prompt. Hindi confusable pairs authored by a native Hindi speaker.
- **English phase structure:** Phase 1 — letter names (26 letters, say the letter name e.g. "ay" for A). Phase 2 — short CVC-equivalent words (20 words). Phase 3 — 10 additional 5–6 letter words (authored in Phase 9, stored in same content file; no code change required to add them). Difficulty increase after 5 consecutive correct.
- **Hindi phase structure:** Phase 1 — 13 varnamala aksharas (अ, आ, क, ख …). Phase 2 — 15 short Hindi words. Phase 3 — longer words. No CVC concept; authored natively.
- **STT acceptance table:** Each entry in `client/src/content/{en|hi}/echo_galaxy.json` has `target`, `accepted[]`, `confusable[]`, `phoneme_category`, `char_length` (English) or `akshara_length` (Hindi).
  ```json
  { "target": "cat", "accepted": ["cat", "kat"], "confusable": ["kit", "cut"], "phoneme_category": "c_k_swap", "char_length": 3 }
  ```
- **Matching rules:** All 5 STT alternatives checked. For items < 5 chars (or < 3 aksharas): exact/accepted-list only. For ≥ 5 chars (≥ 3 aksharas): accepted-list then Levenshtein ≤ 1 on NFC-normalised grapheme arrays. Hindi `accepted[]` includes both Devanagari and romanized variants. If a confusable is matched, log the error category.
- **STT caveat:** Web Speech API may autocorrect mispronunciations → false positives. Results are approximate; override always available.
- **Manual override:** 🔒 button hidden when `users.override_pin_hash` is NULL. PIN checked server-side via `POST /api/child/verify-override-pin` (rate-limited: 5 / 10 min). Logged as `self_reported_count`.
- **Session data logged:** target, all 5 STT alternatives, match result, match_method, error category (if confusable hit), override flag, self_reported_count.

### Game 3 — Astrotales
- **MVP (lite):** One story per language, displayed sentence by sentence. Reuses Echo Galaxy's matching logic (`matchingUtils.ts`) and the same STT/"I said it!" fallback. Self-reported and override attempts are logged as `self_reported_count` and excluded from accuracy.
- **STRETCH (full):** Multiple stories, real-time word-level highlighting, comprehension questions, per-sentence accuracy bar, level progression.
- **Level 1–2:** 3-sentence stories, high-frequency words, large font.
- **Level 3–4 (STRETCH):** 5-sentence stories, less common words.
- **Level 5+ (STRETCH):** Paragraph-length stories with comprehension question.
- **Matching rules:** Same tiered approach as Echo Galaxy — exact/accepted-list for words under 5 chars, Levenshtein ≤ 1 for words 5+ chars. STT autocorrect caveat applies; override remains available.
- **Hindi stories:** Authored natively in Hindi; word segmentation uses `Intl.Segmenter` in grapheme-cluster mode (not code points) to correctly split Devanagari text.
- **Real-time feedback:** mismatched words highlighted in amber; guide repeats correct pronunciation.
- **Session data logged:** per-word accuracy (excluding self_reported), mispronounced word list, total fluency score, self_reported_count.

### Game 4 — Word Orbit
- **Mechanic:** Scrambled letter tiles on an orbital ring. Child drags/taps to reorder into a word.
- **Level 1–3:** 3-letter CVC words (English) / 2–3 akshara words (Hindi).
- **Level 4–6:** 4-letter words, one distractor tile.
- **Level 7+:** 5–6-letter words, two distractor tiles. **No time bonus or visible timer at any level.** Completion time recorded silently.
- **Hindi tiles:** Words stored in `client/src/content/hi/word_orbit.json` as pre-segmented `tiles[]` arrays (e.g. `["क", "म", "ल"]`). Do not rely on runtime `Intl.Segmenter` for tile splitting — it is used only in a CI validation test to verify the stored arrays are correct. This ensures correct conjunct handling without runtime dependency.
- **Anagram safety:** The word generator checks for ambiguous anagrams (e.g. "was"/"saw"). If an ambiguous anagram exists, either choose a different word or add it to `alternatives[]` so any valid ordering is accepted.
- **Hint system:** After 2 failed attempts, first letter/grapheme snaps into place; after 4, second.
- **Session data logged:** word presented, attempts, `time_to_solve_ms` (silent, not shown), hints_used.

### Game 5 — Math Mission (Number Navigator)
- **Mechanic:** The child pilots a spaceship flying through a scrolling galaxy. Numbered asteroids drift across the path; the child must identify a **target number** displayed by the guide, then match it to the correct arithmetic operation (+, −, ×, ÷) shown on asteroid "path gates" to clear the route. The guide speaks every problem aloud before the child answers.
- **Quantity visuals:** Every numeral is shown alongside a quantity visual — dot groups (subitizing dots) for numbers 1–10, or a number line segment for larger numbers. Every operation is shown as both a symbol (+) and its spoken name ("plus") displayed on the asteroid gate.
- **Level 1–3:** Number recognition 1–10. Guide says "Find the asteroid that shows the number FIVE!" — child taps the correct asteroid among 3 options.
- **Level 4–6:** Simple addition/subtraction (sum ≤ 20). Guide reads the equation: "Three plus four equals … which gate?" Three answer-gate choices.
- **Level 7+:** Multiplication/division; word problems read aloud by guide; distractors within ±2 of correct answer.
- **Progress visual:** Spaceship moves forward and gains speed on correct answers; drifts on wrong answers; guide gives spoken encouragement.
- **🔊 replay button** on each question so child can re-hear the problem without penalty.
- **Session data logged:** target number/operation presented, answer given, correct/incorrect, `response_time_ms` (silent), replay count.

---

## Rewards System

### Earning Points
- Each completed level awards **space points** computed server-side by `pointsFormula.ts`:
  - If `verified_attempts > 0`: `points = (base[level] × max(accuracy, 0.5)) + completion_bonus`, where `accuracy = correct / verified_attempts`, capped at `MAX_POINTS_PER_SESSION`.
  - If `verified_attempts == 0` (all self-reported): `points = base[level] × 0.5` (50% of base, no accuracy bonus). No divide-by-zero; `accuracy` is stored as NULL.
  - `base[level]`: level 1–3 = 10, level 4–6 = 20, level 7+ = 35. `completion_bonus` = 5. `MAX_POINTS_PER_SESSION` = 40.
  - A single level-1 session typically awards **10–15 points**.
- `POST /api/child/sessions` validates body with **Zod**, then in a single Prisma transaction: inserts `game_sessions` (checking `(child_id, client_session_id)` for idempotency), upserts `child_game_progress`, increments **both** `children.total_points` and `children.points_balance`. **Does not** check unlock thresholds or insert unlock rows. Returns updated totals. Duplicate `(child_id, client_session_id)` → 200 with cached result, no re-insert.
- Child JWT expires in **2 hours**. On 401, client shows re-login screen then resubmits pending sessions from retry queue.

### Spending Points — Unlock Shop
- Planets and themes are **purchased** in the Unlock Shop, not automatically awarded.
- Unlock costs are defined in `server/src/lib/pointCosts.ts`:
  | Unlock key | Type | Cost |
  |---|---|---|
  | `mercury` | planet | 10 pts |
  | `venus` | planet | 30 pts |
  | `mars` | planet | 60 pts |
  | `saturn` | planet | 100 pts |
  | `aurora` | theme | 80 pts |
  | `void` | theme | 150 pts |
- `POST /api/child/unlocks { unlock_key }` (requires `requireChild`): single Prisma transaction — reads cost from `pointCosts.ts`, reads `children.points_balance`, rejects with 402 if insufficient, decrements `points_balance`, inserts `unlocks` row (unique on `(child_id, unlock_key)`, returns 409 if already owned).
- `children.total_points` is **never decremented** — it is the lifetime earned total used for parent-dashboard progress charts.
- `children.points_balance` is the spendable amount; it decreases with each purchase.
- `unlocks` table unique on `(child_id, unlock_key)` prevents duplicates.
- **Unlock Shop UI** — `<UnlockShop />` component on `ChildDashboard`: lists all purchasable items with cost, locked/owned state, and "Buy" button. Guide speaks each item description and the purchase confirmation. Character celebrates successful unlocks with an animated TTS praise sequence (`{ queue: true }`).
- All games are **always accessible** regardless of unlock status. Unlocks apply only to planets (visual galaxy map) and themes (CSS var sets). No content is gated.

---

## Speech Pipeline

### Global rule — guide speaks everything
The guide character must speak **every** instruction, prompt, feedback message, story sentence, math problem, and comprehension question aloud in every game and on every screen. A **🔊 replay button** is rendered on every screen that has active spoken content; clicking it re-triggers the last `speak()` call without resetting game state.

### Browser compatibility
**`SpeechRecognition` (STT) is only available in Chrome and Edge.** On Firefox, Safari, and all other browsers, the STT microphone flow is unavailable. In those browsers:
- Echo Galaxy and Astrotales (lite) show a tap-based "I said it!" button fallback. These attempts are logged as `self_reported_count` in `game_sessions`, are **excluded from accuracy calculations**, and are shown **separately** in the parent dashboard (labelled "Self-reported attempts") so parents can distinguish them from STT-verified answers.
- TTS (`SpeechSynthesis`) works in all modern browsers. If no `hi-IN` voice is available, show a **visible notice** ("Hindi voice not installed on this device") and still display all text in large type so the child can follow along. Azure TTS fallback is STRETCH.
- The `useSpeechRecognition` hook detects browser support on init and exposes an `isSupported` boolean; all game components render the appropriate fallback UI when `isSupported === false`.

### "I said it!" and PIN override — logging policy
Both the "I said it!" tap and the PIN override log `self_reported_count` in `game_sessions.errors`. They are excluded from the accuracy formula. The parent dashboard shows them in a separate labelled panel ("Self-reported / teacher-assisted") so parents understand the context. The override button is **hidden** when `users.override_pin_hash` is NULL.

### PIN override rate limiting
PIN attempts are rate-limited server-side: maximum 5 attempts per 10-minute window per `childId`. Exceeding this locks the override button for the remainder of the session and logs a warning.

### Audio unlock
Browser autoplay policies block audio until a user gesture. In the `ChildLogin` tile tap handler, **speak a short greeting utterance** (e.g. "Hello!" / "नमस्ते!") synchronously in the login-screen language using `useSpeechSynthesis`, **before** any `await`. This is the correct unlock mechanism — `AudioContext.resume()` alone does not unlock `SpeechSynthesis`. `useSpeechSynthesis` must wait for the `voiceschanged` event to fire before selecting a Hindi or English voice, because voices may not be populated synchronously. After login, the full greeting is spoken in the child's own `preferred_language`.

### `useSpeechSynthesis` — speak() behaviour
`speak(text, lang)` **cancels current speech by default** before speaking the new utterance. Pass `{ queue: true }` to queue instead (used only for celebration lines). This ensures move narration and error feedback never overlap with each other.

### `useSpeechSynthesis` lifecycle
`useSpeechSynthesis` calls `window.speechSynthesis.cancel()` on React Router route change (via a `useEffect` cleanup tied to `useLocation`). This prevents orphaned speech continuing after the child navigates away.

### `useSpeechRecognition` — multi-alternative matching
Set `SpeechRecognitionEvent.results[i].length` (i.e. `maxAlternatives`) to **5** so the STT engine returns up to 5 candidate transcripts. Check every alternative against the accepted list before applying Levenshtein. This significantly reduces false negatives on short words and accented speech.

### `useSpeechRecognition` — error handling
The hook must handle the following `SpeechRecognitionError` event types and switch to the "I said it!" fallback with a spoken+visible message:
- `not-allowed` / `permission-denied` — microphone access denied. Message: "Microphone blocked. Tap 'I said it!' to continue."
- `no-speech` — no input detected within timeout. Message: "I couldn't hear anything. Try again or tap 'I said it!'."
- `network` — STT unavailable (no internet or API error). Message: "Speech check unavailable. Tap 'I said it!' to continue."
- `aborted` — recognition aborted. Silently switch to fallback.
In all error cases, `requiresFallback` becomes `true` for the rest of the session.

### Text-to-Speech (character voice, instructions, stories)
1. Use **Web Speech API `SpeechSynthesis`** as the primary engine (zero cost, available in all modern browsers).
2. On init, wait for `speechSynthesis.onvoiceschanged` (or `speechSynthesis.getVoices().length > 0`) before selecting a voice. Select a `hi-IN` voice or `en-US` voice based on `preferred_language`.
3. If no `hi-IN` voice is found after `voiceschanged` fires, show a visible notice on screen and still display all text in large type. **STRETCH:** call the server-side Azure TTS proxy (`POST /api/speech/tts`) and play the returned audio blob. Azure keys are never sent to the client.
4. The `useSpeechSynthesis` hook exposes `speak(text, lang)` and `replay()`.

### Speech-to-Text (Echo Galaxy, Astrotales)
1. Use **Web Speech API `SpeechRecognition`** (Chrome/Edge only) with `lang` set to `en-US` or `hi-IN`, and `maxAlternatives = 5`.
2. **STRETCH fallback:** For Hindi or unsupported browsers, a server-proxied Azure Speech route can be added (`GET /api/speech/token` returns a short-lived Azure STS token). Azure keys are never in client code.
3. Raw audio is **never stored**. Only transcripts and pass/fail scores are persisted.
4. The `useSpeechRecognition` hook exposes `startListening(lang)` / `stopListening()` / `transcript` / `isSupported`.

### Azure key security (STRETCH)
Azure Speech credentials (`AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`) are server-only env vars. The client never receives them. MVP stubs two routes (both move to STRETCH for full implementation):
- `GET /api/speech/token` — returns a short-lived Azure STS token for client SDK use.
- `POST /api/speech/tts` — proxies TTS text → audio blob.

---

## Biometric Authentication (WebAuthn)

### Policy
Biometric authentication (WebAuthn, platform authenticator, `userVerification: "required"`) is **compulsory** for child login. Username/password is an **optional additional step** (not a replacement) that parents may configure for extra security, but it cannot substitute for biometrics.

**`DEV_BIOMETRIC_BYPASS=true` env flag:** Allowed only when `APP_ENV=development` or `APP_ENV=demo`. The server **refuses to start** if `DEV_BIOMETRIC_BYPASS=true` and `APP_ENV=production`. `APP_ENV` replaces `NODE_ENV` for this guard to allow a "demo" deployment that bypasses biometrics without being confused with the standard Node production mode.

### Challenge storage
WebAuthn challenges are stored in the **PostgreSQL `webauthn_challenges` table** (no Redis dependency). Each row has a `challenge` (TEXT), `child_id` (FK), `expires_at` (TIMESTAMPTZ, 5-minute TTL), and is deleted on use or expiry.

### `webauthn_challenges` table
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| child_id | UUID FK → children | nullable (null during registration before child is known) |
| challenge | TEXT | base64url challenge string |
| expires_at | TIMESTAMPTZ | now + 5 minutes |
| created_at | TIMESTAMPTZ | |

### Device-local child list (non-demo)
After a parent completes biometric registration for a child, the child's `id` is appended to a `registered_children` JSON array in `localStorage`. `ChildLogin.tsx` reads this array and shows only the children enrolled on the current device as avatar tiles. This means the child never has to type anything to identify themselves. Entries returning 404 are removed from `localStorage`.

### Demo login (bypass mode)
When `DEV_BIOMETRIC_BYPASS=true` and `APP_ENV != production`:
- `GET /api/auth/demo-children` — returns all `is_demo=true` children as `[{ id, name, avatar_emoji }]`. **No authentication required** (read-only, non-PII).
- `POST /api/auth/child/demo-login { childId }` — verifies the child `is_demo=true`, then returns a child JWT.
- `ChildLogin.tsx` shows these tiles in a "Demo Mode" banner section. **Does not** depend on `localStorage.registered_children` for demo children.

### Env vars required
`WEBAUTHN_RP_ID` (e.g. `neurolexia.app`) and `WEBAUTHN_ORIGIN` (e.g. `https://neurolexia.app`) must be set. The server **refuses to start** if either is missing.

### Environment guard
The server **refuses to start** (throws at boot) if `DEV_BIOMETRIC_BYPASS=true` AND `APP_ENV=production`. `WEBAUTHN_RP_ID` must equal the hostname of the frontend origin — in development this is `localhost`. Documented in `README.md`.

### authenticatorAttachment and userVerification clarification
Registration options include `authenticatorAttachment: "platform"` (device-bound, not roaming keys). `userVerification: "required"` means the device performs a user-verification step — this is **device unlock** (biometric OR device PIN/pattern), not necessarily biometric-only. Parents should be informed that a device PIN suffices. Before showing the registration UI, check `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` and display a friendly message if unavailable ("This device does not support biometric/PIN login. Please use a different device or enable screen lock.").

### Registration flow (parent sets up child account)
1. Parent logs in → opens child profile → clicks "Set up Biometric Login". Registration endpoints are protected by `requireParent` + ownership.
2. Client checks `isUserVerifyingPlatformAuthenticatorAvailable()`. If false, show friendly message; abort.
3. Client calls `GET /api/auth/webauthn/register/options?childId=...` (protected by `requireParent`).
4. Server generates registration options (`generateRegistrationOptions`, `userVerification: "required"`, `authenticatorAttachment: "platform"`, `rpId: WEBAUTHN_RP_ID`), inserts challenge row in `webauthn_challenges`.
5. Client calls `navigator.credentials.create()` with options.
6. Client sends attestation response to `POST /api/auth/webauthn/register/verify` (protected by `requireParent`).
7. Server verifies, deletes challenge row, stores `credential_id` (unique), `public_key`, `counter` in `child_credentials`.
8. On success, client stores `{ childId, name, avatar_emoji }` (from the child profile already in memory — **no unauthenticated fetch**) into `localStorage.registered_children`. Remove entries when the server returns 404 for that childId.

### Authentication flow (child login)
1. `ChildLogin.tsx` renders two sections:
   - **Demo tiles** (if `DEV_BIOMETRIC_BYPASS=true` and `APP_ENV != production`): fetched from `GET /api/auth/demo-children`. No `localStorage` dependency.
   - **Registered tiles**: read from `localStorage.registered_children` — cached `{ childId, name, avatar_emoji }`, no unauthenticated API calls. Entries returning 404 are removed.
2. **Normal biometric path:** Child taps a registered tile → `GET /api/auth/webauthn/authenticate/options?childId=...` → `navigator.credentials.get()` with `userVerification: "required"` → `POST /api/auth/webauthn/authenticate/verify`.
3. If `children.password_hash` is set, `POST /api/auth/webauthn/authenticate/verify` returns a **short-lived "pending" token** (`{ role: "pending_child", childId, exp: now+5min }`) instead of the full child JWT. The client then shows a password prompt and calls `POST /api/auth/child/password { pendingToken, password }`, which verifies the bcrypt hash server-side and exchanges it for a full child JWT. **Pending tokens cannot access `/api/child/*`** — `requireChild` middleware rejects `role: "pending_child"`.
4. If `children.password_hash` is NULL, `POST /api/auth/webauthn/authenticate/verify` returns the full child JWT directly.
5. **Demo path:** Child taps a demo tile → `POST /api/auth/child/demo-login { childId }` → full child JWT returned directly (no pending step).
6. Non-demo children **cannot** use the demo endpoint. Bypass is blocked entirely when `APP_ENV=production`.

### Child-scoped API routes
All routes prefixed `/api/child/` require `requireChild` middleware (role must be `"child"`). The child JWT may only access data for its own `childId`.
- `GET /api/child/me` — returns `{ name, character_id, preferred_language, preferred_font, total_points, points_balance, unlocks[], child_game_progress[] }`.
- `PATCH /api/child/me` — allows updating `character_id`, `preferred_font`, `preferred_language` only.
- `POST /api/child/sessions` — submit a completed game session (Zod-validated; idempotent via `(child_id, client_session_id)`; transactional; increments both `total_points` and `points_balance`).
- `POST /api/child/unlocks { unlock_key }` — purchase an unlock (deducts `points_balance`; transactional).
- `POST /api/child/verify-override-pin` — verify the parent's override PIN; rate-limited.

Parent-scoped session query: `GET /api/children/:id/sessions` remains parent-only (`requireParent` + ownership).

### Password hashing rule
The API always receives plaintext `password` and `override_pin` from the client and hashes them server-side with bcrypt. The server **never accepts** a pre-hashed value from the client. This applies to `POST /api/auth/register` (parent), `PUT /api/children/:id` (child password), and `PUT /api/children/:id` (override PIN).

### JWT roles and ownership middleware
All JWTs carry a `role` field: `"parent"`, `"child"`, or `"pending_child"`.
- **`requireParent` middleware:** verifies JWT role is `parent`.
- **`requireChild` middleware:** verifies JWT role is `child`; rejects `"pending_child"`. Attaches `childId` to `req`.
- **`requirePendingChild` middleware:** verifies JWT role is `pending_child`; used only by `POST /api/auth/child/password`.
- **Ownership checks:** On any `/api/children/:id` route, the server verifies the requesting parent's `id` matches the child's `parent_id`. A child JWT may only access routes scoped to its own `childId`.

### Library: `@simplewebauthn/server` (Node) + `@simplewebauthn/browser` (React).

---

## IBM watsonx.ai Report Pipeline

### Data aggregation (server: `reportBuilder.ts`)
1. Query last N `game_sessions` rows for the child within the requested period — **no scores table**. Include `errors` JSONB (for phoneme error categories and `hints_used`), `replay counts` from metadata, `accuracy`, `self_reported_count`.
2. Compute per-game accuracy (excluding self_reported), most frequent error categories (from `errors.phoneme_category` counts), improvement trend, `hints_used` totals, `replay_count` totals.
3. Identify top 3 weak areas using error categories (e.g. `c_k_swap` in Echo Galaxy, multi-step addition in Math Mission).
4. **Pseudonymize:** Send only `age`; no name or PII.

### Data gate
If the child has fewer than **3 verified sessions** in the requested period, `reportBuilder.ts` returns a `{ insufficient_data: true }` flag without calling the model. `Reports.tsx` displays a friendly "Not enough play data yet — keep playing!" message instead of generating a report.

### Prompt construction
Use the **chat endpoint** (`/ml/v1/text/chat`) with `system` + `user` messages. **Verify the token field name** against current IBM docs: the chat endpoint uses `max_tokens` (not `max_new_tokens`); the generation endpoint uses `max_new_tokens`. Use the correct field for whichever endpoint is active.

**Error category labels:** Before building the prompt, map internal error keys to human-readable labels (e.g. `c_k_swap` → "confusing C and K sounds", `i_e_swap` → "mixing I and E sounds", `b_d_swap` → "confusing B and D letters"). Pass human-readable labels to the prompt, not raw key names.

For Hindi, instruct "write entirely in Devanagari Hindi" and use a higher token budget (≈1000 tokens, ~200 target words).

```
System: You are a supportive child education specialist writing a compassionate progress
        note for a parent of a child aged {age} working on literacy and numeracy.
        Write in {language}.
        {if language == hi: Write entirely in Devanagari Hindi script.}
        Use simple, non-clinical language. Structure your response with exactly these
        section headers on their own lines: SUMMARY, WEAK_AREAS, ACTIVITIES.
        {if language == en: Maximum 300 words total.}
        {if language == hi: Target approximately 200 words (about 1000 tokens).}
        ACTIVITIES must contain exactly 3 practical offline items.
        IMPORTANT: Do NOT provide a medical diagnosis. If you observe persistent
        difficulties, recommend consulting a qualified specialist.

User:   Child age: {age}.
        Period: {start} to {end}.
        Game performance summary:
        - Trip to Space: avg accuracy {x}% (verified), levels reached {y}
        - Echo Galaxy: error areas: {human-readable labels}, hints used: {n}, self-reported: {s}
        - Word Orbit: avg attempts {x}, hints used: {n}
        - Math Mission: accuracy {x}% (verified)
        - Astrotales: accuracy {x}% (verified, if played)
        Top weak areas: {human-readable labels}
        Improvement since last period: {delta}
```

### Response parsing
Parse the response text into `summary`, `weak_areas`, `activities` sections using the fixed headers. Store the raw text in `report_text` and the parsed sections in `summary`, `weak_areas`, `activities` columns. If parsing fails (no headers found), fall back to displaying `report_text` as a single block.

### watsonx.ai call (`watsonxService.ts`)
- **Preferred endpoint:** `POST https://{region}.ml.cloud.ibm.com/ml/v1/text/chat?version={WATSONX_API_VERSION}` with `messages: [{role:"system",...},{role:"user",...}]`. Verify this endpoint is available for the configured model; fall back to `/ml/v1/text/generation` if not.
- **`WATSONX_API_VERSION`** env var (e.g. `2024-05-31`); sent as `?version=` query param.
- Request body includes `model_id` and `project_id`. Token field: `max_tokens` for chat endpoint; `max_new_tokens` for generation endpoint.
- English: `max_tokens: 400`. Hindi: `max_tokens: 1000`.
- Model: **`WATSONX_MODEL_ID`** (default: `ibm/granite-3-8b-instruct`). If `WATSONX_MODEL_ID_HI` is set, use it for Hindi reports.
- Auth: Bearer token via IAM API key. `temperature: 0.4`.
- **Truncation retry:** If the response `finish_reason` indicates truncation (e.g. `"stop_reason": "max_tokens"`), retry once with the same prompt. If second response also truncates, fall back to mock.
- **Request timeout:** 15 seconds. On any error, timeout, or non-2xx → fall back to mock (no error thrown).
- **Rate limit:** `POST /api/reports/generate` is limited to **5 requests per child per day**. If a cached report already exists for the same child+period+language, return it without calling the model.
- **Startup check:** Log available model IDs on boot; warn if configured model not found.
- **Mock fallback:** `WATSONX_API_KEY` absent, `WATSONX_MOCK=true`, or any runtime error → canned report with `is_mock: true`, `model_id: null`.
- Store in `ai_reports` with `prompt_used`, `is_mock`, `model_id`.

### Report delivery
- Parent Portal → Reports page → "Generate Report" button (triggers fresh generation) or loads latest cached report.
- If `insufficient_data: true`, show "Not enough play data yet — keep playing!" message; no generate button.
- Report displayed as styled card with sections: Summary, Weak Areas, Suggested Activities.
- A **visible disclaimer** is shown above every report: *"This report is generated by an AI and is for informational purposes only. It is not a medical diagnosis. For persistent concerns, please consult a qualified specialist."* (in the active language).
- Mock badge shown when `is_mock=true`.
- Language toggle regenerates report in the other language on demand.
- **Hindi quality task (MVP):** Generate 5 Hindi reports with the live API and verify coherence, idiomatic quality, and token budget ≤ 1000. If `WATSONX_MODEL_ID` produces poor Hindi, set `WATSONX_MODEL_ID_HI` to a better model. Document findings in README.

---

## i18n Strategy

- **Library:** `i18next` + `react-i18next`
- **i18next scope (UI strings only):** Namespaces `common`, `child`, `parent` — per language directory (`/i18n/en/`, `/i18n/hi/`). Holds button labels, error messages, guide spoken lines, and page titles. **Does not hold game content.**
- **Game content (separate from i18next):** Structured game data (letter/word lists with `accepted[]`, `confusable[]`, `tiles[]`, story text, math problems) lives in `client/src/content/{en,hi}/*.json`. Each file is validated by a **Zod schema in a unit test** (`content.test.ts`) that checks required fields, array types, and that Hindi tile arrays use proper Devanagari strings. This separation keeps i18next lean and makes content auditable.
- **Child language set by parent:** The child's `preferred_language` is set by the parent in the child profile form (large segmented control: English / Hindi) or via the quick-change badge on each child card in the parent dashboard. `PUT /api/children/:id` updates it. `PATCH /api/child/me` does **not** accept `preferred_language` — a child token cannot change the child's language. The child portal has **no** language selection UI of any kind.
- **Child portal language resolution:** Before a child is identified (on the login screen), the portal uses: (1) `localStorage.lastChildLanguage` from the last logged-in child on this device, (2) the parent's currently selected landing-page language (`i18n.language`), or (3) English as a hard fallback. As soon as the child logs in, `i18n` switches to that child's `preferred_language`, `lastChildLanguage` is updated, and TTS switches to match.
- **Language picker — parent portal:** A language pill toggle (EN | HI) is present in the parent portal top bar. On change, calls `i18n.changeLanguage(lang)` and persists to `localStorage`. This toggles the parent's own UI language and is independent of any child's language.
- **Scope of language switch:** Changing language applies to **all** of: UI text, TTS voice, game content (letter sets, story text, math problems), guide character spoken lines, and AI report generation.
- **TTS language sync:** `useSpeechSynthesis` reads current i18n language to select the correct voice automatically.
- **Hindi script:** All Hindi translations use Devanagari script. Load `Noto Sans Devanagari` font as a secondary font for Hindi mode.
- **Hindi game content:** All Hindi game content (varnamala letters, Hindi words, story text, math problem wording) is **authored natively in Hindi**, not translated from English. This applies to Echo Galaxy, Word Orbit, Astrotales, and Math Mission.
- **Hindi text segmentation:** Word Orbit Hindi tile arrays are **pre-stored** in `client/src/content/hi/word_orbit.json` as `tiles[]` arrays (e.g. `["क","म","ल"]`). Do not use runtime `Intl.Segmenter` for tile splitting. `Intl.Segmenter` is used only in a CI content validation test and in `matchingUtils` for Levenshtein on Devanagari grapheme arrays. Never use `.split("")` or code-point iteration on Hindi text.
- **AI report:** Generated separately per language (stored with `language` field); parent can toggle between EN and HI versions; switching triggers generation if the other-language version does not yet exist.
- **CONTENT_REVIEW.md:** Lists every Hindi string and file (`content/hi/*.json`, `i18n/hi/*.json`, guide lines) that must be reviewed by a native Hindi speaker before the hackathon demo. Kept up to date as content is added.

---

## Dyslexia-Friendly Design System

- **Font:** OpenDyslexic (default), Atkinson Hyperlegible, or system default — child's choice, stored in `children.preferred_font` and applied as a CSS class on `<body>`. The font setting is accessible from a gear icon in the child portal top bar. Noto Sans Devanagari is always loaded for Hindi text regardless of font choice.
- **Planets:** Drawn as CSS radial-gradient circles with SVG ring accents — no PNG assets. Each planet has a named gradient defined in `globals.css`.
- **Character sprites:** Inline SVG or Unicode emoji combinations stored in the `characters.sprite_svg` DB column. No external image files needed for the hackathon demo. Sprites can be replaced with commissioned artwork by updating the DB seed.
- **Font size:** Minimum 18px body, 24px+ game labels, 32px headings.
- **Line height:** 1.8 minimum.
- **Letter spacing:** 0.12em.
- **Word spacing:** 0.16em.
- **Color palette (space theme):**
  - Background: `#05071a` (near-black navy)
  - Surface: `#0d1035`
  - Accent: `#7b61ff` (purple nebula)
  - Highlight: `#ffd700` (star gold)
  - Text: `#e8eaf6` (off-white)
  - Error: `#ff6b6b`
  - Success: `#69db7c`
- **Contrast ratio:** All text/background pairs ≥ 7:1 (WCAG AAA).
- **Spacing:** Minimum 16px padding around all interactive elements. Touch targets ≥ 48×48px.
- **Animations:** Gentle, slow (≥ 600ms). No rapid flashing. `prefers-reduced-motion` respected.
- **StarBackground component:** CSS `@keyframes` for slowly drifting star particles — pure CSS, no canvas, no PNG files.

---

## Phased Implementation Plan

Phase labels: **[MVP]** = must ship for hackathon. **[STRETCH]** = valuable but not blocking.

**Build order:** Phase 0 (Scaffold) → Phase 1 (Parent Auth) → Phase 2 (Child bypass login + speech hooks) → Phase 3 (Dashboard Shell) → Phase 4 (Trip to Space + `POST /api/child/sessions`) → Phase 5 (Parent Dashboard) → Phase 6 (AI Report) → Phase 7 (Demo Seed) → Phase 8 (Real WebAuthn) → Phase 9 (Echo Galaxy) → Phase 10 (Word Orbit) → Phase 11 (Math Mission) → Phase 12 (Astrotales lite + STRETCH) → Phase 13 (Rewards/Unlock Shop/Themes) → Phase 14 (Accessibility, Polish & Testing) → Phase 15 (Deploy & Demo Prep). Phase 2 is bypass-only so all games are buildable without a biometric device; Phase 8 drops in real WebAuthn without touching game code.

---

### Phase 0 — Project Scaffold [MVP]
**Intent:** Bootstrap monorepo, install dependencies, wire up routing, i18n, DB, and environment.
**Status:** [-] in progress — steps 1–14 complete (DB + servers running); step 15 (commit) pending

**Todo:**
1. Initialize **npm workspaces** monorepo: root `package.json` with `"workspaces": ["client","server","shared"]`. Create `client/` (Vite + React + TypeScript), `server/` (Node + Express + TypeScript), `shared/` with its own `package.json` and `tsconfig.json`. Configure tsconfig path aliases: `@shared/*` → `../../shared/*` in both client's `vite.config.ts` and server's `tsconfig.json`.
2. Install and configure Tailwind CSS with custom space palette CSS variables; define `aurora` and `void` theme CSS variable sets.
3. Install OpenDyslexic, Atkinson Hyperlegible, and Noto Sans Devanagari fonts; add `dyslexia.css` baseline; add `FontSetting` component (gear icon in child portal top bar).
4. Install and configure `i18next` + `react-i18next`; create stub JSON files for EN and HI in namespaces `common`, `child`, `parent` (3 namespaces — no `games.json`; game content goes in `client/src/content/`). Create stub `content/en/` and `content/hi/` JSON files for each game.
5. Add `<LanguagePicker />` full-screen component (child flow first step) and `<LanguageToggle />` pill (parent portal top bar); wire both to i18n. **Audio unlock happens in Phase 2 via a spoken greeting — do NOT call `AudioContext.resume()` here.**
6. Install Prisma; write `schema.prisma` with all tables: `users`, `children` (with `preferred_font`, `is_demo`, `points_balance`, `character_id` nullable), `child_credentials` (`credential_id` UNIQUE), `webauthn_challenges`, `characters` (with `sprite_svg`), `game_sessions` (merged; UNIQUE on `(child_id, client_session_id)`), `child_game_progress` (UNIQUE on `(child_id, game_type)`), `unlocks` (UNIQUE on `(child_id, unlock_key)`), `ai_reports` (with `is_mock`, `model_id`, parsed section columns). `onDelete: Cascade` on all FK relationships from `children`. No `scores` table. Run initial migration.
7. Set up Express server with CORS (`CORS_ORIGIN` env var), JSON body parser, and `/api/health` route. Set `PORT` from env. Add boot-time guard: refuse if `WEBAUTHN_RP_ID` or `WEBAUTHN_ORIGIN` missing, or `DEV_BIOMETRIC_BYPASS=true` and `APP_ENV=production`. Note in README: WebAuthn and microphone require HTTPS (localhost is exempt).
8. Add rate limiting (`express-rate-limit`) to auth routes and PIN override route (5 / 10 min per childId). Add report generation rate limiter (5 per child per day).
9. Set up Axios instance in `services/api.ts` with `VITE_API_URL` as base URL; add retry queue: on 401 store pending session bodies in `localStorage` and show re-login screen; on re-login success resubmit queue.
10. Add `.env.example` with all keys: `DB_URL`, `PORT`, `CORS_ORIGIN`, `VITE_API_URL`, `JWT_SECRET`, `WATSONX_API_KEY`, `WATSONX_PROJECT_ID`, `WATSONX_REGION`, `WATSONX_MODEL_ID`, `WATSONX_MODEL_ID_HI`, `WATSONX_API_VERSION`, `WATSONX_MOCK`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `DEV_BIOMETRIC_BYPASS`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`, `APP_ENV`.
11. Write `shared/matchingUtils.ts`: NFC-normalise → lowercase → trim → strip punctuation/ZWJ/ZWNJ → split into grapheme array → compare. Export `checkMatch(alternatives: string[], accepted: string[], charLength: number): MatchResult`. For Levenshtein (≥5 chars / ≥3 aksharas): operate on grapheme arrays. Client re-exports from `client/src/lib/matchingUtils.ts`. Write unit tests.
12. Write `server/src/lib/pointsFormula.ts`: `computePoints(level, verifiedCorrect, verifiedTotal, allSelfReported): { points, accuracy }`. Handle zero-divide; handle all-self-reported case. `base[1-3]=10, base[4-6]=20, base[7+]=35, completion_bonus=5, MAX=40`. Write unit tests. Write `server/src/lib/pointCosts.ts`: cost map `{ mercury: 10, venus: 30, mars: 60, saturn: 100, aurora: 80, void: 150 }`.
13. Seed characters using `prisma/seed.ts` with 2 original SVG characters (Astro/astronaut, Comet/comet). Run seed.
14. Create `CONTENT_REVIEW.md` stub listing all Hindi content files to be reviewed before the demo.
15. Commit and verify both dev servers start with `npm run dev` from workspace root.

**Relevant Context:** All tables in the DB Schema section above. Folder structure above.

---

### Phase 1 — Parent Portal: Auth & Child Profile Management [MVP]
**Intent:** Let parents register, log in, and create child profiles — the data foundation everything else depends on.
**Status:** [ ] pending

**Todo:**
1. Implement `POST /api/auth/register` — server receives plaintext `password`, hashes with bcrypt, sets `users.consent_given_at` when consent checked. `POST /api/auth/login` → bcrypt compare + JWT `role: "parent"`, 24 h expiry.
2. Build `ParentRegister.tsx` with mandatory consent checkbox. **Exact wording:** *"I agree that game activity (transcripts and scores — never raw audio) is stored to generate progress reports. Speech recognition in Chrome/Edge sends audio to the browser vendor's cloud service (Google/Microsoft). NeuroLexia never receives or stores audio. If Azure Speech is enabled, audio may be processed by Azure. Children's data laws (e.g. India's DPDP Act) require legal review before public launch."* Disable submit until checked.
3. Build `ParentLogin.tsx` with bilingual form labels and language pill toggle.
4. Implement `requireParent`, `requireChild`, and `requirePendingChild` JWT middleware; ownership check helper; protect all `/api/children` routes with `requireParent` + ownership.
5. Add stub routes `GET /api/speech/token` and `POST /api/speech/tts` (return 501; full Azure proxy is STRETCH).
6. Implement `GET/POST/PUT/DELETE /api/children` routes; `POST`/`PUT` accept plaintext `password` and `override_pin` — server hashes them with bcrypt; never store raw values. Include `preferred_font`, `character_id` (nullable).
7. Implement `POST /api/auth/child/password { pendingToken, password }` — verifies pending JWT role, bcrypt-compares password, returns full child JWT.
8. Implement child-scoped routes in `server/src/routes/child.ts`: `GET /api/child/me` (returns `total_points`, `points_balance`), `PATCH /api/child/me` (character_id, preferred_font, preferred_language only), `POST /api/child/sessions` (stub; Phase 4), `POST /api/child/unlocks` (stub; Phase 13), `POST /api/child/verify-override-pin` (rate-limited).
9. Implement `DELETE /api/children/:id/data` — **explicitly** `deleteMany` for `game_sessions`, `child_game_progress`, `ai_reports`, and `unlocks`; reset `total_points = 0` and `points_balance = 0`; keep profile and credentials. `requireParent` + ownership.
10. Implement `DELETE /api/children/:id` — full removal (relies on Cascade for credentials, sessions, etc.). `requireParent` + ownership.
11. Build `ChildProfile.tsx`: name, age, language, optional username/password (plaintext sent), override PIN (plaintext sent, blank → hidden override button in games), character selection.
12. Add `<CharacterSelect />` — 5 character cards with SVG sprite preview, name, short description.
13. Verify parent can register with consent (checkbox required), create a child, and see it in the dashboard.

**Relevant Context:** `users`, `children`, `characters` tables. `requireParent`, ownership middleware. `authStore.ts`. Rate limiters from Phase 0.

---

### Phase 2 — Child Portal: Language Picker, Bypass Login, Character Select & Character Guide [MVP]
**Intent:** Unblock the game loop with bypass login; build all speech hooks and the character guide. Real WebAuthn is Phase 8.
**Status:** [ ] pending

**Todo:**
1. Language is now set by the **parent** in `ChildProfileForm` (segmented control) and via quick-change badge on the parent dashboard. `LanguagePicker.tsx` has been removed. Child portal entry point is now `/child/login` directly. `PATCH /api/child/me` does not accept `preferred_language`. The child portal has no language selection UI. (Audio unlock is now in `ChildLogin`'s tile tap handler — see Audio unlock section.)
2. Build `useSpeechSynthesis.ts`: `speak(text, lang, { queue?: boolean })` — cancels current speech by default; `{queue:true}` for celebration lines only. Waits for `voiceschanged` before selecting voice. If no matching voice found, display visible notice; still show all text in large type. `replay()` re-speaks last utterance. `cancel()` on route change via `useLocation` cleanup. STRETCH: falls back to `POST /api/speech/tts`.
3. Build `useSpeechRecognition.ts`: `startListening(lang)`, `stopListening()`, `transcript` (array of up to 5 alternatives), `isSupported`, `requiresFallback`; `maxAlternatives = 5`; Web Speech API (Chrome/Edge). `isSupported === false` → sets `requiresFallback`. Handle `not-allowed`, `no-speech`, `network`, and `aborted` errors → set `requiresFallback = true` with spoken+visible messages (see Speech Pipeline).
4. Implement demo login endpoints: `GET /api/auth/demo-children` (no auth required; returns `is_demo` children list) and `POST /api/auth/child/demo-login { childId }` (verifies `is_demo = true`, returns full child JWT). Blocked when `APP_ENV=production`.
5. Build `ChildLogin.tsx`: two sections — **Demo tiles** (fetched from `GET /api/auth/demo-children` when bypass active; no `localStorage` dependency) and **Registered tiles** (from `localStorage.registered_children`; 404 entries removed). If `children.password_hash` is set on a registered child, biometric success returns a pending token → show password prompt → `POST /api/auth/child/password` → full JWT. Use first seeded character as default guide on this screen (before `character_id` is set).
6. Build `<CharacterGuide />`: renders `sprite_svg` (or first seeded character if `character_id` is null), speech bubble, 🔊 replay button. Wire into every child-portal page.
7. Build `CharacterSelect.tsx`: shown on first login (if `character_id` is null) or when child taps "Change Guide"; saves via `PATCH /api/child/me` (`character_id`).
8. Wire `GET /api/child/me` into child portal to load profile, `total_points`, `points_balance`, unlocks, and progress on app init.
9. Verify bypass login in Chrome and Firefox; verify greeting speaks before other content; verify route-change cancels speech; verify "I said it!" renders in Firefox; verify Hindi voice notice appears when no `hi-IN` voice.

**Relevant Context:** Speech Pipeline section. `children`, `child_credentials` tables. `useSpeechSynthesis`, `useSpeechRecognition`. `DEV_BIOMETRIC_BYPASS`. `is_demo`.

---

### Phase 3 — Child Portal: Star Background & Dashboard Shell [MVP]
**Intent:** Establish the space-themed visual environment and game selection hub.
**Status:** [ ] pending

**Todo:**
1. Build `<StarBackground />` component: CSS keyframe-animated star field (pure CSS, no PNG files). Draw planets using CSS radial-gradient circles + SVG ring accents defined in `globals.css`.
2. Apply space palette CSS variables globally; verify contrast ratios meet WCAG AAA.
3. Build `ChildDashboard.tsx`: grid of 5 `<GameCard />` tiles (game name + icon — **all always accessible, never locked**), galaxy map area showing CSS-gradient planet orbs (owned = glowing, unowned = dim), `total_points` and `points_balance` counters, and `<UnlockShop />` (stub for Phase 13).
4. Build `<GameCard />` component: large icon, game name text (spoken by guide on focus/hover). All cards are always enabled; no locked state on game cards.
5. Ensure `<CharacterGuide />` with 🔊 replay button appears on dashboard with introductory TTS prompt.
6. Verify that when a child with `preferred_language = hi` logs in, all visible text switches to Hindi and the TTS voice changes to hi-IN (or shows the notice if unavailable); verify changing language mid-session re-speaks the current instruction.

**Relevant Context:** Design system section above. `unlocks` table (planets/themes only). `gameStore.ts`.

---

### Phase 4 — Game 1: Trip to Space (Maze) [MVP]
**Intent:** Implement the directional maze game. Also fully implements `POST /api/child/sessions` transactional endpoint used by all subsequent games.
**Status:** [ ] pending

**Todo:**
1. Build maze grid generator (4×4, 6×6, 8×8; seeded, solvable). All four directions valid from Level 1.
2. Build `TripToSpace.tsx`: render grid, highlight player position, guide sprite at goal cell. On start, call `GET /api/child/me` to read `child_game_progress` and resume correct level.
3. On game start: guide speaks direction tutorial with labelled arrow visuals. 🔊 replay button. No timer.
4. Directional controls: four labeled arrow buttons + keyboard arrows.
5. After every valid move: guide speaks direction ("You went LEFT") using `speak(text, lang)` (default cancel-current behaviour; not queued).
6. On invalid move: guide speaks "Oops, I can't go there, try again!" (default cancel-current).
7. Level 7+: obstacles advance one step after child's move (turn-based). No timer.
8. On rescue: guide speaks celebration line with `{ queue: true }` (so it doesn't cut the last move narration).
9. Fully implement `POST /api/child/sessions`: Zod-validate body (include `client_session_id`); single Prisma transaction — upsert on `(child_id, client_session_id)` for idempotency; insert `game_sessions` (`accuracy` = `valid_moves / total_moves` for Trip to Space; NULL when all self-reported), upsert `child_game_progress`, `pointsFormula.computePoints()`, increment `children.total_points` AND `children.points_balance`. **Do not** check unlock thresholds or insert `unlocks` rows. Return updated `total_points` and `points_balance`.
10. On level complete: POST to `/api/child/sessions`; display both points counters.
11. Implement level progression (1–3 → 4–6 → 7+).
12. `metadata` fields: `total_moves`, `wrong_moves`, `completion_time_ms` (silent), `tutorial_replays`.

**Relevant Context:** Trip to Space game logic. Session Definition section (accuracy formula). `game_sessions`, `child_game_progress`, `children` tables. `pointsFormula.ts`. Zod validation.

---

### Phase 5 — Parent Dashboard: Progress Charts & Graphs [MVP]
**Intent:** Give parents visual insight into their child's activity and improvement over time.
**Status:** [ ] pending

**Todo:**
1. Implement `GET /api/children/:id/sessions?period=week|month` endpoint aggregating `game_sessions` (protected by `requireParent` + ownership). Accuracy excludes self_reported.
2. Build `ParentDashboard.tsx`: summary cards (total sessions, avg verified accuracy, points earned).
3. Weekly bar chart (Recharts `BarChart`) per game type — verified accuracy only.
4. Monthly line chart (`LineChart`) — accuracy trend over time.
5. Per-game detail panel: error category breakdown (e.g. `c_k_swap` counts for Echo Galaxy); `hints_used`; `replay_count`.
6. Separate panel per game: `self_reported_count` per session, labelled "Self-reported / teacher-assisted attempts".
7. All chart labels and tooltips i18n-aware.

**Relevant Context:** `game_sessions` table. Recharts. `requireParent` middleware.

---

### Phase 6 — AI Report (IBM watsonx.ai) [MVP]
**Intent:** Generate parent-friendly AI reports explaining the child's activity.
**Status:** [ ] pending

**Todo:**
1. Implement `reportBuilder.ts`: read `game_sessions` only; compute per-game verified accuracy using per-game formulas (see Session Definition section), map error keys to human-readable labels, count `hints_used` and `replay_count`; pseudonymize (age only); identify top 3 weak areas. Return `{ insufficient_data: true }` if fewer than 3 verified sessions in the period.
2. Boot startup check: log available watsonx model IDs; warn if `WATSONX_MODEL_ID` or `WATSONX_MODEL_ID_HI` not found.
3. Implement `watsonxService.ts`: try chat endpoint (`/ml/v1/text/chat?version=...`); fall back to generation endpoint. Include `model_id`, `project_id` in body. Use `max_tokens` for chat endpoint, `max_new_tokens` for generation endpoint. EN: 400 tokens; HI: 1000 tokens. On truncation (`finish_reason == max_tokens`): retry once; if truncated again → mock. 15s timeout → mock. Parse SUMMARY/WEAK_AREAS/ACTIVITIES. Store `is_mock`, `model_id`.
4. Implement `POST /api/reports/generate` (`requireParent` + ownership, rate-limited 5/day/child): check for existing cached report for same child+period+language → return it without calling model if found. If `insufficient_data`, return 200 with flag. Otherwise call builder + watsonx; store `ai_reports`.
5. Implement `GET /api/reports?childId=` returning latest report and list.
6. Build `Reports.tsx`: if `insufficient_data`, show "Not enough play data yet — keep playing!" message. Otherwise show "Generate Report" button; styled card with Summary/Weak Areas/Suggested Activities sections (or raw text fallback). **Visible disclaimer** (not a diagnosis; consult a specialist). Mock badge when `is_mock=true`.
7. Language toggle on report page → generates in other language if not yet available.
8. Test with mock data; verify sections parse correctly; verify raw fallback works; verify insufficient-data message; verify cached report is returned without calling model on second request.
9. **Hindi quality task (MVP):** Generate 5 Hindi reports; verify Devanagari output, coherence, ≤1000 tokens. Set `WATSONX_MODEL_ID_HI` if needed; document in README.

**Relevant Context:** AI Report Pipeline section. `ai_reports` table. `watsonxService.ts`. `reportBuilder.ts`.

---

### Phase 7 — Demo Seed Data [MVP]
**Intent:** Realistic demo data for a populated hackathon demo without real play.
**Status:** [ ] pending

**Todo:**
1. Write `prisma/seed-demo.ts`: 1 demo parent, 1 demo child (`is_demo=true`), 4 weeks of `game_sessions`. Realistic variance — improving accuracy, mix of error categories, some days off. Cover: Trip to Space, Echo Galaxy, Word Orbit, Math Mission. Include at least 3 verified sessions per game (to clear the `insufficient_data` gate for AI reports).
2. Include `self_reported_count > 0` on some sessions.
3. Set `total_points` and `points_balance` so the demo shows an interesting shop state: e.g. Mercury and Venus already purchased (cost 10+30=40), `points_balance` ≈ 60 (enough to buy Mars at 60, not quite aurora at 80).
4. **Threshold check:** Verify a single level-1 session awards 10–15 points (not 30+; Mercury costs only 10 pts).
5. Idempotent (upsert by demo email). Safe to re-run.
6. Add `npm run seed:demo` to `server/package.json`.
7. Verify: seed → `GET /api/auth/demo-children` returns demo child → bypass login works → Parent Dashboard shows 4-week charts with self-reported panel → "Generate Report" produces a meaningful AI report.

**Relevant Context:** `game_sessions`, `child_game_progress`, `unlocks`, `children`, `users` tables. `pointsFormula.ts`, `pointCosts.ts`. Session Definition section.

---

### Phase 8 — Real WebAuthn Registration & Authentication [MVP]
**Intent:** Replace bypass login with real biometric/device-PIN authentication.
**Status:** [ ] pending

**Todo:**
1. Install `@simplewebauthn/server` and `@simplewebauthn/browser`.
2. Implement `webauthn_challenges` CRUD helper (insert, lookup by challenge, delete expired rows).
3. Registration endpoint `GET /api/auth/webauthn/register/options` + `POST /api/auth/webauthn/register/verify` — protected by `requireParent` + ownership; `userVerification: "required"`, `authenticatorAttachment: "platform"`, `rpId: WEBAUTHN_RP_ID`. On success, client stores `{ childId, name, avatar_emoji }` in `localStorage.registered_children` (no unauthenticated fetch). `credential_id` stored as UNIQUE.
4. Authentication endpoint `GET /api/auth/webauthn/authenticate/options` + `POST /api/auth/webauthn/authenticate/verify`. If `children.password_hash` is set, return pending JWT (`role: "pending_child"`, 5-min expiry); otherwise return full child JWT.
5. Update `ChildLogin.tsx`: real WebAuthn path for non-demo children (pending token flow if password set); demo path uses `GET /api/auth/demo-children` + `POST /api/auth/child/demo-login`.
6. Before showing registration UI, check `isUserVerifyingPlatformAuthenticatorAvailable()`; show friendly message if false.
7. Add WebAuthn registration trigger to `ChildProfile.tsx` (parent side).
8. Clean up stale `localStorage.registered_children` entries that return 404.
9. **Manual testing (document in README):** (a) Chrome on biometric device; (b) parent registers credential; (c) child logs in; (d) verify JWT; (e) wrong finger → rejected; (f) verify bypass blocked for non-demo child; (g) verify `APP_ENV=production` blocks bypass entirely; (h) if password set, verify pending token blocks `/api/child/*` until password exchanged.

**Relevant Context:** `child_credentials`, `webauthn_challenges` tables. WebAuthn section. `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`, `APP_ENV`, `is_demo`.

---

### Phase 9 — Game 2: Echo Galaxy (Phoneme Practice) [MVP]
**Intent:** Implement letter/word supportive practice with tiered matching, confusable detection, override, and STT fallback UI.
**Status:** [ ] pending

**Todo:**
1. Hooks from Phase 2 already exist. Verify `maxAlternatives = 5` and `isSupported` in Chrome/Firefox.
2. **English content:** `client/src/content/en/echo_galaxy.json` — 26 letter names + 20 CVC words + 10 extra 5–6 letter words (Phase 3 content). Each item: `target`, `accepted[]`, `confusable[]`, `phoneme_category`, `char_length`. **All letter items also have confusable[]**: letter B → confusable `["d", "p"]` (`b_d_swap`), letter C → confusable `["k"]` (`c_k_swap`), etc. Include word minimal pairs: cat/kit (`c_k_swap`), pin/pen (`i_e_swap`), bad/dad (`b_d_swap`). STT autocorrect variants in `accepted`. Phase 3 words (5–6 letters) in same file.
3. **Hindi content:** `client/src/content/hi/echo_galaxy.json` — 13 aksharas + 15 words + 8 extra longer words. Confusable pairs authored by a native Hindi speaker. Both Devanagari and romanized variants in `accepted[]`. `akshara_length` field. Add file to `CONTENT_REVIEW.md` for native-speaker review.
4. Build `EchoGalaxy.tsx`: guide says letter name/word via TTS (🔊 replay); mic (Chrome/Edge) OR "I said it!" (other browsers). "I said it!" increments `self_reported_count`.
5. Matching via `matchingUtils.checkMatch(alternatives[], accepted[], charLength)` (all 5 alternatives, NFC-normalised grapheme arrays). After accepted-list, check `confusable[]` — if matched, log the `phoneme_category` error. Log `match_method`.
6. On correct: praise TTS + advance. On fail: retry up to 3 times, gentle skip.
7. Override button shown **only if** `users.override_pin_hash` not NULL. Checked via `POST /api/child/verify-override-pin` (rate-limited). On success: mark correct, increment `self_reported_count`.
8. Phase transitions read/write `child_game_progress.phase` via `POST /api/child/sessions`.
9. Log `game_sessions`: verified accuracy, attempts, `self_reported_count`, `errors` JSONB (category counts, match_method counts). No raw audio.
10. Verify Hindi end-to-end; verify "I said it!" in Firefox; override hidden when no PIN.

**Relevant Context:** Echo Galaxy game logic. `matchingUtils.ts`. `users.override_pin_hash`. `child_game_progress`. `game_sessions`.

---

### Phase 10 — Game 4: Word Orbit (Scrambled Letters) [MVP]
**Intent:** Implement the drag-to-unscramble word puzzle with pre-segmented Hindi tiles and no visible timers.
**Status:** [ ] pending

**Todo:**
1. Author word lists in `client/src/content/en/word_orbit.json` and `client/src/content/hi/word_orbit.json`. English — 3-letter CVC, 4-letter, 5–6-letter with distractors. Hindi — `tiles[]` arrays pre-segmented (e.g. `["क","म","ल"]`; do not use runtime `Intl.Segmenter`). Anagram check: if two orderings are both valid words, add to `alternatives[]`. Add Hindi file to `CONTENT_REVIEW.md`. Validate both files with Zod content schema in `content.test.ts`.
2. Build `WordOrbit.tsx`: render letter/grapheme tiles on an orbital arc using CSS transforms.
3. Drag-and-drop (or tap-select-place) reordering via Framer Motion drag. **No timer shown.**
4. Validate word on submit (check `alternatives[]` too); on fail increment attempts.
5. Hint system: 2 fails → snap first tile; 4 fails → snap second.
6. Guide speaks target word on start and after each fail. `speak(word, lang)` (default cancel-current). 🔊 replay.
7. Log: `hints_used`, `time_to_solve_ms` (silent).

**Relevant Context:** Word Orbit game logic. `game_sessions`. `client/src/content/{en,hi}/word_orbit.json` tile arrays.

---

### Phase 11 — Game 5: Math Mission (Number Navigator) [MVP]
**Intent:** Implement the spaceship number navigator with quantity visuals and spoken problems.
**Status:** [ ] pending

**Todo:**
1. Build `MathMission.tsx`: scrolling galaxy background; spaceship CSS animation; numbered asteroid CSS/SVG components (no PNG).
2. Each numeral shown with quantity visual: dot groups (1–10) or number line segment (>10). Each operation shown as symbol + spoken name.
3. Level 1–3: guide announces target number (🔊 replay); child taps correct asteroid from 3.
4. Level 4–6: guide reads full equation aloud; 3 answer-gate asteroids.
5. Level 7+: multiplication/division; word problems; distractors within ±2.
6. Spaceship advances on correct (guide: `{queue:true}` encouragement); drifts on wrong.
7. 🔊 replay re-reads problem without penalty.
8. Log: target/operation, answer, correct/incorrect, `response_time_ms` (silent), replay count.

**Relevant Context:** Math Mission game logic. TTS. `game_sessions`.

---

### Phase 12 — Game 3: Astrotales — Lite (MVP) + Full (STRETCH)
**Intent:** MVP = one story per language reusing `matchingUtils` and STT/"I said it!" fallback. STRETCH = full multi-level story game.
**Status:** [ ] pending

**Todo:**
**MVP — Astrotales Lite:**
1. Author 1 story per language in `client/src/content/{en,hi}/astrotales.json`: `{ sentence, words: string[] }[]`. Hindi authored natively; Hindi word arrays are plain pre-split strings (no runtime segmentation needed for short words). Add Hindi file to `CONTENT_REVIEW.md`.
2. Build `AstrotalesLite.tsx`: one sentence at a time, large font. Guide reads sentence aloud (🔊 replay, `{queue:false}`). "Read it!" starts STT (or "I said it!" fallback). Uses `matchingUtils.checkMatch()`.
3. "I said it!" increments `self_reported_count`. Show STT notice on non-Chrome/Edge.
4. On story complete: summary screen with verified accuracy. Log `game_sessions`.

**STRETCH — Full Astrotales:**
5. 4–6 stories per language with difficulty levels; real-time word-level amber highlighting; per-sentence accuracy bar; comprehension questions.
6. Level selection from previous `game_sessions` accuracy.

**Relevant Context:** Astrotales game logic. `matchingUtils.ts`. `game_sessions`.

---

### Phase 13 — Rewards, Unlock Shop & Themes [MVP]
**Intent:** Implement `POST /api/child/unlocks`, the `<UnlockShop />` UI, galaxy map, and CSS-var theme switching. Points are earned in `POST /api/child/sessions` (since Phase 4); this phase adds the spending side.
**Status:** [ ] pending

**Todo:**
1. Add `pointCosts.ts` (already created in Phase 0 as a stub). Finalise cost map: `{ mercury: 10, venus: 30, mars: 60, saturn: 100, aurora: 80, void: 150 }`.
2. Fully implement `POST /api/child/unlocks { unlock_key }`: single Prisma transaction — read cost from `pointCosts.ts`, read `children.points_balance`, reject 402 if insufficient, decrement `points_balance`, insert `unlocks` (return 409 if already owned). Return updated `points_balance` and new unlock.
3. Build `<UnlockShop />` component: list all purchasable items with name, cost, and owned/affordable/locked states. Guide speaks each item description on focus and the purchase confirmation on success. Character speaks celebration with `{ queue: true }` on successful purchase.
4. Build galaxy map in `ChildDashboard.tsx`: owned planets as CSS-gradient glowing orbs; unowned planets dim circles (but still visible). Show `total_points` (lifetime) and `points_balance` (spendable) counters.
5. Theme switching: when `aurora` or `void` in child's unlocks, child can select it from the shop/settings; apply CSS var set on `<body>`.
6. **STRETCH:** Additional themes and unlock keys.

**Relevant Context:** `unlocks`, `children.points_balance`. `pointCosts.ts`. Rewards System section. `POST /api/child/sessions`.

---

### Phase 14 — Accessibility, Polish & Testing [MVP]
**Intent:** Harden UX, verify i18n, run all tests, write README.
**Status:** [ ] pending

**Todo:**
1. Audit all pages against dyslexia design system (font, spacing, contrast).
2. Add `prefers-reduced-motion` to all animations.
3. Verify all i18n keys populated in EN and HI namespaces (`common`, `child`, `parent`); add missing translations.
4. Verify all content files in `client/src/content/{en,hi}/` have valid Zod schemas; run `content.test.ts`.
5. Review `CONTENT_REVIEW.md`; mark items as reviewed; if native Hindi speaker unavailable, annotate with "needs review before public demo".
6. Add ARIA labels; verify keyboard navigation on parent portal.
7. Rate limiting verified active in all environments (added Phase 0).
8. **Unit tests:** `matchingUtils.checkMatch()` — exact hit, accepted-list hit, Levenshtein hit (≥5 chars), Levenshtein rejection (<5 chars), multi-alternative hit, NFC normalisation, Devanagari grapheme arrays. `pointsFormula.computePoints()` — level 1/4/7, zero verified attempts (returns null accuracy, 50% base), all-self-reported case, cap enforcement.
9. **Integration tests (bypass login):** `DEV_BIOMETRIC_BYPASS=true`, `APP_ENV=development`, `is_demo=true` child. Cover: (a) parent register (consent required) → create child → `GET /api/auth/demo-children` → `POST /api/auth/child/demo-login` → child JWT; (b) complete Trip to Space level → `game_sessions` inserted, `children.total_points` and `points_balance` both incremented, `child_game_progress` upserted, **no `unlocks` row**; (c) `POST /api/child/unlocks { unlock_key: "mercury" }` → balance deducted, `unlocks` row inserted; (d) second purchase of same key → 409; (e) purchase with insufficient balance → 402; (f) Echo Galaxy "I said it!" → `self_reported_count > 0`, excluded from accuracy; (g) `(child_id, client_session_id)` idempotency: submit same session twice → second returns 200 with cached result, no duplicate row.
10. **Manual WebAuthn steps (in README):** (a) Chrome on biometric device; (b) parent registers credential (check `isUserVerifyingPlatformAuthenticatorAvailable` first); (c) child logs in with device unlock; (d) verify JWT; (e) wrong credential → rejected; (f) non-demo child → bypass rejected; (g) `APP_ENV=production` → bypass rejected; (h) child with password → pending token blocks `/api/child/*` until exchanged.
11. **Browser matrix:** Chrome/Edge — full functionality including STT. Firefox/Safari — TTS-only; verify no silent failures. Document in README.
12. Write `README.md`: setup instructions; all env vars with examples; `APP_ENV` values; `WEBAUTHN_RP_ID = frontend hostname` note; "WebAuthn and microphone require HTTPS (localhost exempt)"; "How we used IBM Bob"; "How we use IBM watsonx.ai"; browser requirements; *"Platform biometrics confirm device-presence, not child identity"* note; demo credentials; `npm run seed:demo` instructions.

---

### Phase 15 — Deploy & Demo Prep [MVP]
**Intent:** Get the app live on HTTPS, smoke-test all features, and prepare a 3-minute demo.
**Status:** [ ] pending

**Todo:**
1. **Frontend (Vercel):** Add `vercel.json` with SPA rewrite rule (`"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]`) so React Router works on direct URL loads. Set `VITE_API_URL` to the Railway backend URL.
2. **Backend (Railway):** Deploy Node + Express. Set env vars: `DB_URL` (Railway Postgres), `PORT`, `CORS_ORIGIN` (Vercel frontend URL), `JWT_SECRET`, `WATSONX_*`, `WEBAUTHN_RP_ID` (Vercel hostname, no `https://`), `WEBAUTHN_ORIGIN` (full `https://` URL), `APP_ENV=demo`, `DEV_BIOMETRIC_BYPASS=true`.
3. **DB migration:** Run `npx prisma migrate deploy` then `npx prisma db seed` (characters) then `npm run seed:demo` on Railway.
4. **HTTPS smoke-test checklist:** (a) Open app on Chrome (HTTPS) — verify mic permission prompt and TTS work; (b) verify WebAuthn registration and login flow; (c) open on Firefox — verify "I said it!" fallback shown, no STT prompt; (d) verify guide speaks on first load (audio unlock).
5. **3-minute demo script:**
   - Minute 0–1: Parent portal — register, create child, view dashboard with 4-week charts, generate AI report (EN then HI).
   - Minute 1–2: Child portal — demo login, character selection, play Trip to Space (1 level), earn points, open Unlock Shop, buy Mercury.
   - Minute 2–3: Echo Galaxy (letter + word, show STT matching), Word Orbit (drag tiles), show parent dashboard updated.
6. **Backup:** Record a screen capture of the full 3-minute demo script on HTTPS Chrome; save as `demo-backup.mp4` so the demo can be shown if live network is unavailable.
7. **Cut line (if time runs out, drop in this order):** (a) Astrotales — show stub screen instead; (b) Real WebAuthn — demo mode only; (c) Hindi language toggle — English-only demo; (d) AI report — mock report only. Document cut items in README.

**Relevant Context:** All env vars from Phase 0. WebAuthn section (WEBAUTHN_RP_ID must match deployed hostname). Demo seed from Phase 7.

---

## Key Open Decisions / Trade-offs

| Decision | Choice Made | Rationale |
|---|---|---|
| Biometric auth | WebAuthn compulsory, `userVerification: "required"` | Strongest identity guarantee for children; platform authenticator only |
| Biometric bypass | `DEV_BIOMETRIC_BYPASS=true`; allowed in `development` and `demo` APP_ENV; blocked in `production` | Lets hackathon demos run; hard guardrail prevents prod use |
| APP_ENV vs NODE_ENV | Use `APP_ENV` (development, demo, production) for the bypass guard | Allows a "demo" deployment without conflating it with Node's prod optimisations |
| Username/password | Optional additional step after biometrics | Additive security only; biometrics remain mandatory |
| Character change | Child can change after login; parent can change via ChildProfile | Empowers the child; parent retains admin override |
| Character assets | Original placeholder artwork | Avoids Marvel IP issues; swap in commissioned art before launch |
| WebAuthn challenge storage | PostgreSQL `webauthn_challenges` table | Removes Redis dependency; simpler infra for hackathon |
| Demo login endpoints | `GET /api/auth/demo-children` + `POST /api/auth/child/demo-login`; no localStorage dependency for demo | Simpler demo UX; no stale cache issues |
| Device-local child list | `localStorage.registered_children` populated after registration | Child never types to identify themselves; touchscreen-friendly |
| WEBAUTHN_RP_ID | Must equal the frontend hostname (localhost in dev) | Documented in README; mismatch causes credential errors |
| Biometric identity caveat | README note: platform biometrics confirm device presence, not child identity | Accurate framing for parents; platform limitation, not a flaw |
| Build order split | Phase 2 = bypass + hooks; Phase 8 = real WebAuthn | Unblocks game development; real auth added without disrupting games |
| Password second factor | If password_hash set: biometric → pending token → POST /api/auth/child/password → full JWT | Pending token blocks /api/child/* until password verified; no partial access |
| Password hashing | API always receives plaintext; server hashes with bcrypt; never accept pre-hashed from client | Prevents hash-relay attacks |
| Language picker tap = audio unlock | LanguagePicker tap speaks a greeting utterance | `AudioContext.resume()` alone does not unlock SpeechSynthesis; speaking does |
| voiceschanged event | `useSpeechSynthesis` waits for `voiceschanged` before selecting voice | Voices not synchronously populated in all browsers |
| Guide speaks everything | Global rule enforced in every game screen | Children with dyslexia may not be able to read; audio is the primary channel |
| Replay button | 🔊 on every screen with spoken content | Child can re-hear without restarting; reduces frustration |
| STT browser support | Chrome/Edge only; other browsers get "I said it!" fallback | Web Speech API limitation; documented in README and shown in UI |
| STT maxAlternatives | Set to 5; all alternatives checked against accepted list | Reduces false negatives for short words and accented speech |
| STT matching — short items | Exact/accepted-list only for items < 5 chars | Levenshtein on short strings produces too many false positives |
| STT matching — long items | Accepted-list then Levenshtein ≤ 1 for ≥ 5 chars | Balances tolerance vs. false positives for longer words |
| STT autocorrect caveat | Results approximate; override always available | Web Speech API may silently correct mispronunciations |
| Hindi accepted lists | Include both Devanagari and romanized variants | STT may return either; both must be accepted |
| "I said it!" / override logging | Logged as `self_reported_count`; excluded from accuracy; shown separately in parent dashboard | Transparent to parents; does not inflate reported accuracy |
| Override PIN visibility | Button hidden when `users.override_pin_hash` is NULL | No false promise of an override that is not configured |
| Override rate limiting | 5 attempts / 10 min per childId; locks button for session | Prevents brute-force PIN guessing |
| Consent text | Discloses browser speech service (e.g. Google in Chrome) and Azure (if enabled) | Informed consent; parents know what touches the child's voice |
| Consent mechanism | `consent_given_at` timestamp — basic mechanism, not full legal compliance | Sufficient for hackathon; legal review required before public launch |
| Font setting | Child can choose OpenDyslexic, Atkinson Hyperlegible, or default from gear icon | Supports different dyslexia needs; stored in `children.preferred_font` |
| Hindi game content | Authored natively, not translated | Varnamala, Hindi words, math wording differ structurally from English |
| Hindi text segmentation | `Intl.Segmenter` grapheme clusters | `.split("")` breaks conjuncts and matras in Devanagari |
| Echo Galaxy launch content cap | 26 EN letters + 20 EN words; 13 HI aksharas + 15 HI words | Manageable authoring; expandable without code changes |
| Azure key security | Server-only; client gets short-lived token or blob via proxy | Never expose cloud keys to browser |
| Azure TTS/STT fallback | STRETCH; MVP stubs return 501 | Reduces MVP scope; Web Speech API covers English well |
| Visible timers | Removed from all games | Removes performance anxiety; time logged silently |
| Trip to Space move narration | Guide speaks direction after every valid move | Reinforces directional language; supports children who cannot read labels |
| Trip to Space level 7+ | Moving obstacles are turn-based (advance after child's move) | Avoids real-time stress; keeps the no-timer promise |
| Scores table | Merged into `game_sessions` (accuracy, attempts, errors, self_reported_count columns) | Single table for session data; simplifies queries and seed |
| child_game_progress table | Unique on (child_id, game_type); upserted in POST /api/child/sessions transaction | Persists level and phase per game; consistent source of truth |
| Points formula | `base_points[level] × accuracy_ratio`, capped per session; server-side only | Auditable; formula in `pointsFormula.ts` with unit tests |
| Spendable points | `total_points` (lifetime, never decremented) + `points_balance` (spendable) | Chart integrity preserved; balance reflects actual spendable amount |
| Unlock model | POST /api/child/unlocks: check cost, check balance, deduct, insert — no auto-unlock on session | Child agency; explicit purchase in shop; no implicit side-effects in session submit |
| client_session_id uniqueness | UNIQUE(child_id, client_session_id) — per-child, not global | Prevents cross-child collisions while allowing same UUID on different children |
| POST /api/child/sessions validation | Zod schema on request body; does not insert unlocks | Rejects malformed payloads; unlock is a separate transaction |
| Unlocks unique constraint | `(child_id, unlock_key)` in DB | Idempotent purchase; 409 on duplicate |
| Child JWT expiry | 2 hours | Limits session window; child re-authenticates via biometric |
| Two MVP themes | `aurora` and `void` via CSS variable swap | Tangible reward early; no complex theming infra needed |
| Astrotales | MVP = lite (1 story, reuses matchingUtils); STRETCH = full multi-level | Delivers the feature without over-engineering for hackathon |
| watsonx.ai model | `WATSONX_MODEL_ID` (default `ibm/granite-3-8b-instruct`); `WATSONX_MODEL_ID_HI` for Hindi if needed | Model switchable without code deploy; Hindi quality addressed separately |
| watsonx.ai API version | `WATSONX_API_VERSION` env var; sent as `?version=` query param | Matches IBM API contract; updateable without code change |
| watsonx.ai token field | `max_tokens` for chat endpoint; `max_new_tokens` for generation endpoint | API contract varies by endpoint; wrong field silently ignored |
| watsonx.ai HI token budget | 1000 tokens (~200 words) for Hindi | Devanagari tokenizes differently; more tokens needed for same word count |
| watsonx.ai truncation retry | On truncation: retry once; if still truncated → mock | Resilient to edge cases without infinite retries |
| watsonx.ai data gate | Fewer than 3 verified sessions → no model call, friendly message | Avoids nonsense reports with insufficient data |
| watsonx.ai error key labels | Map c_k_swap etc. to human-readable labels before prompt | Model does not know internal codes; human labels produce better output |
| watsonx.ai rate limit | 5 POST /api/reports/generate per child per day; cached reports returned free | Prevents API cost runaway; demo-safe |
| watsonx.ai timeout & fallback | 15s timeout; any error → mock fallback, never fail the request | Demo resilience; no broken report page |
| watsonx.ai PII | Child name excluded; only age sent | Privacy-safe prompt |
| watsonx.ai disclaimer | Visible on every report; no-diagnosis instruction in prompt | Responsible AI; legal safety |
| Hindi report quality | MVP task: test 5 Hindi reports; use `WATSONX_MODEL_ID_HI` if poor | Quality verified before demo |
| Phase ordering | 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 | Sequential build; bypass login unblocks games; WebAuthn added without touching game code |
| i18next scope | UI strings only (common/child/parent); game content in client/src/content/ | Separation of concerns; content auditable independently; i18next stays lean |
| Content validation | Zod schema unit test for all content JSON files | Catches missing fields, wrong types, invalid Devanagari before runtime |
| CONTENT_REVIEW.md | Lists all Hindi strings for native-speaker review | Ensures quality before demo; does not block development |
| Hindi text segmentation | Tiles pre-stored in word_orbit.json; Intl.Segmenter in matchingUtils + CI tests only | No runtime segmentation dependency; tiles always correct |
| Session definition | One completed level attempt | Unambiguous; abandoned levels are not submitted |
| Per-game accuracy | Trip to Space: valid/total moves; EG+Astrotales: verified correct/attempts; WO: first-submit/presented; MM: correct/answered | Each game has a meaningful domain-specific accuracy metric |
| Drag-and-drop library | Framer Motion drag | Already in stack for animations; avoids an extra dependency |
| Game state persistence | Server-side sessions only | Client-side state is not authoritative |
| Child-to-parent linking | Parent creates child profile | Parent controls the link; child cannot self-register |
| character_id nullable | NULL until first selection; pre-login screens use first seeded character | No blank screens before character is picked; child always has a guide |
| All games always accessible | Unlocks apply only to planets and themes; no game-gating | Every child can play every game regardless of points balance |
| npm workspaces | client, server, shared as workspace packages; path alias @shared | Type-safe cross-package imports without publishing; simpler than monorepo tools |
| Deploy target | Vercel (frontend) + Railway (backend + Postgres) | Free tier; HTTPS by default; no Docker required for hackathon |

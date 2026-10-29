# NeuroLexia

A bilingual (English/Hindi) gamified, space-themed learning platform for dyslexic children.

## Portals
- **Child Portal** — 5 space-themed games guided by a character; biometric (WebAuthn) login
- **Parent Portal** — progress dashboard + IBM watsonx.ai AI reports

---

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16 (running locally or via Docker)
- npm 9+

### 1. Install dependencies
```bash
npm install          # from workspace root — installs all workspaces
```

### 2. Configure environment
```bash
cp server/.env.example server/.env
# Edit server/.env — at minimum set DB_URL and JWT_SECRET
cp client/.env.example client/.env.local
# Edit client/.env.local if your API runs on a port other than 3001
```

### 3. Set up the database
```bash
cd server
npx prisma migrate deploy       # applies all migrations
npm run db:seed                  # seeds Astro and Nova characters
npm run seed:demo-parent         # creates the demo parent + child account
cd ..
```

`npm run db:seed` and `npm run seed:demo-parent` are both idempotent — safe to run multiple times.

### 4. Start both servers
```bash
npm run dev          # from workspace root
```

The client runs on **http://localhost:5173** and the server on **http://localhost:3001**.

---

## Environment Variables

### Server (`server/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DB_URL` | ✅ | — | PostgreSQL connection string |
| `PORT` | — | `3001` | Express listen port |
| `CORS_ORIGIN` | — | `http://localhost:5173` | Allowed origin for CORS |
| `APP_ENV` | — | `development` | `development`, `demo`, or `production` |
| `JWT_SECRET` | ✅ | — | Secret for signing JWTs (min 32 random chars in production) |
| `WEBAUTHN_RP_ID` | ✅ | — | Frontend hostname (no `https://`, no port). In dev: `localhost` |
| `WEBAUTHN_ORIGIN` | ✅ | — | Full frontend origin. In dev: `http://localhost:5173` |
| `DEV_BIOMETRIC_BYPASS` | — | `false` | `true` to skip biometrics for `is_demo` children. Blocked in `production`. |
| `WATSONX_API_KEY` | — | — | IBM Cloud API key for watsonx.ai |
| `WATSONX_PROJECT_ID` | — | — | watsonx.ai project ID |
| `WATSONX_REGION` | — | `us-south` | watsonx.ai region (e.g. `eu-de`, `jp-tok`) |
| `WATSONX_MODEL_ID` | — | `ibm/granite-3-8b-instruct` | Model for English reports |
| `WATSONX_MODEL_ID_HI` | — | — | Optional separate model for Hindi reports |
| `WATSONX_API_VERSION` | — | `2024-05-31` | API version query param |
| `WATSONX_MOCK` | — | `true` | `true` skips the real API and returns a mock report |
| `AZURE_SPEECH_KEY` | — | — | Azure Speech key (STRETCH — not used in MVP) |
| `AZURE_SPEECH_REGION` | — | — | Azure Speech region (STRETCH) |

### Client (`client/.env.local`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | — | _(blank)_ | Express API base URL. Leave blank in development — Vite proxy handles it. In production set to your API URL. |
| `VITE_APP_ENV` | — | `development` | `development` shows the demo account button and API status badge |

---

## Child Portal Transition

When a child clicks **Child Portal** on the landing page, a cartoon rocket animation plays (~2.3 s): the rocket enters from the bottom-left corner, crosses the whole screen diagonally through a glowing portal ring, and exits at the top-right corner while the child-portal route loads underneath.

### Customising the transition

All tunables live in one file: [`client/src/components/transition/childPortalLaunchConfig.ts`](client/src/components/transition/childPortalLaunchConfig.ts)

#### Change the rocket angle

```ts
// Fixed 50° tilt (degrees clockwise from north):
export const ROCKET_ANGLE_MODE: 'follow-path' | number = 50;

// Or keep the nose pointing along the path (default):
export const ROCKET_ANGLE_MODE = 'follow-path';
```

#### Change the speed

Decrease `LAUNCH_MS` for a faster rocket (minimum sensible value: ~600 ms).
Also decrease `PAGE_SWAP_AT_MS`, `WARP_END_MS`, and `TOTAL_MS` proportionally.

```ts
export const LAUNCH_MS     = 700;   // was 1000
export const PAGE_SWAP_AT_MS = 1000; // was 1400
export const WARP_END_MS   = 1400;  // was 1900
export const TOTAL_MS      = 1800;  // was 2300
```

#### Change the portal colours

```ts
// [outerRing, innerRing] — any CSS colour string
export const PORTAL_COLORS: [string, string] = ['#ff6b35', '#00e5ff'];
```

#### Disable the portal ring

```ts
export const SHOW_PORTAL_RING = false;
```

#### prefers-reduced-motion

When the OS has reduced-motion enabled, the transition is replaced by a plain 300 ms cross-fade. No rocket, no particles, no sound.

#### Sound

Sounds are synthesised with the Web Audio API (no files). They respect the global Sounds toggle. To disable sounds permanently set `SOUND_ENABLED_DEFAULT = false` in the config.

---

## HTTPS Note

**WebAuthn and microphone access require HTTPS in production.** `localhost` is exempt — the app runs fine on HTTP locally. When deploying, ensure both the frontend (Vercel) and backend (Railway/Fly) are served over HTTPS, and set `WEBAUTHN_RP_ID` to the Vercel hostname.

## WebAuthn Note

`WEBAUTHN_RP_ID` must exactly equal the frontend hostname — for example `neurolexia.vercel.app` (no `https://`, no port, no trailing slash). A mismatch causes credential errors. In development, use `localhost`.

> **Note on biometric identity:** Platform biometric authentication (Face ID, fingerprint, device PIN) confirms that the registered device is present. It does not independently verify that the specific child — rather than another person with access to the device — is the one logging in. This is an inherent limitation of platform authenticators, not a flaw in this application.

---

## Demo Mode

Set `APP_ENV=demo` and `DEV_BIOMETRIC_BYPASS=true` to enable demo login for `is_demo=true` children. The server **refuses to start** if `DEV_BIOMETRIC_BYPASS=true` and `APP_ENV=production`.

### Demo Credentials

| Field | Value |
|---|---|
| Email | `demo.parent@neurolexia.app` |
| Password | `Demo@1234` |
| Child | Aarav, age 7, preferred language: English |

**To seed the demo account** (run once from the `server/` directory):
```bash
npm run seed:demo-parent
```

This creates the demo parent and one demo child with sample game sessions pre-populated. Idempotent — safe to run multiple times.

The **"Use demo account"** button appears on the Parent Login page when `VITE_APP_ENV=development`. It auto-fills credentials and logs in. Hidden in production.

---

## Browser Support

| Feature | Chrome / Edge | Firefox | Safari |
|---|---|---|---|
| Full app | ✅ Full support | ✅ Full support | ✅ Full support |
| Speech-to-text (STT) | ✅ Web Speech API | ❌ Fallback shown | ❌ Fallback shown |
| Text-to-speech (TTS) | ✅ | ✅ | ✅ |
| WebAuthn biometrics | ✅ | ✅ | ✅ |
| WebAuthn platform (Touch ID / Windows Hello) | ✅ | ✅ | ✅ |

On Firefox and Safari, Echo Galaxy and Astrotales display a tap-based **"I said it!"** button instead of the microphone. These attempts are logged as `self_reported_count > 0` and shown separately in the parent dashboard's self-reported panel.

---

## How we used IBM Bob

IBM Bob was used as the primary development and planning assistant throughout this project:

- **Plan mode** — designed the full architecture, database schema (Prisma), API contracts, and 15-phase implementation plan from scratch
- **Agent mode** — implemented each phase with tool-assisted file creation, editing, migration running, and test execution
- **Validation** — verified Prisma schema changes, TypeScript types, Zod schemas, and API response shapes before and after each implementation phase
- **Content authoring** — generated initial bilingual i18n strings (EN/HI), character SVG sprite anatomy descriptions, and accessibility copy
- **Security review** — audited JWT role isolation, rate limits, CORS configuration, and secrets handling in Phase 14
- **Test authoring** — wrote integration tests for sessions idempotency, unlock purchases, story-mode metadata, content schema validation, and auth flows

All 15 phases were planned and executed within a single Bob workspace with full context continuity.

---

## How we use IBM watsonx.ai

IBM watsonx.ai powers the AI-generated progress reports in the Parent Portal:

- Uses the `ibm/granite-3-8b-instruct` model via the **chat completions endpoint** (`/ml/v1/text/chat`)
- Receives **pseudonymized session data only**: child age and aggregated game accuracy — never name, email, or any other PII
- Returns **structured reports** with three labelled sections: `SUMMARY`, `WEAK_AREAS`, `ACTIVITIES`
- Reports are **bilingual**: English by default; Hindi reports (`preferred_language=hi`) use Devanagari script and a configurable separate model (`WATSONX_MODEL_ID_HI`)
- A visible disclaimer is shown on every report: *"This report is generated by an AI and is for informational purposes only. It is not a medical diagnosis."*
- Falls back to a **mock report** when `WATSONX_MOCK=true` or when the API is unavailable, so the parent dashboard always shows something useful
- A configurable **retry loop** (3 attempts, exponential back-off) guards against transient API errors
- **Rate-limited** to 5 report generations per IP per 24 hours

---

## Character Assets

Both characters — **Astro** and **Nova** — are original illustrated designs rendered entirely in hand-built SVG with Framer Motion animations. No WebGL, no external model files, no third-party IP.

| Character | Key | File |
|---|---|---|
| Astro | `astro` | `client/src/components/child/characters/AstroSvg.tsx` |
| Nova  | `nova`  | `client/src/components/child/characters/NovaSvg.tsx`  |

Moods: `idle` (floating bob + blink), `speaking` (head-bob + mouth open), `celebrate` (jump + raised arms), `oops` (head tilt + shoulder shrug). All animations respect `prefers-reduced-motion`.

---

## Security Notes

- **JWT role isolation**: child JWTs (`role: 'child'`) are rejected on all parent routes, and vice versa. Roles are enforced by dedicated middleware (`requireParent` / `requireChild`).
- **Parent data isolation**: all parent routes verify that the requested `childId` belongs to the authenticated parent via `assertOwnership()`.
- **Rate limits**: auth endpoints 20 req / 15 min per IP; PIN override 5 req / 10 min; report generation 5 req / 24 h.
- **Bcrypt cost 12**: password hashing is intentionally slow to resist brute-force.
- **No secrets in client bundle**: all API keys are server-side only. `VITE_*` env vars are safe to expose in the client (they contain no secrets).
- **Boot guards**: the server refuses to start without `JWT_SECRET` and `DB_URL`, and refuses to start with `DEV_BIOMETRIC_BYPASS=true` + `APP_ENV=production`.

---

## Project Structure

```
neurolexia/
├── client/              React + Vite frontend
│   ├── src/
│   │   ├── components/  Shared UI + game components
│   │   ├── content/     Game content JSON (en/, hi/)
│   │   ├── hooks/       useSpeechSynthesis, useProgressSync, …
│   │   ├── i18n/        UI strings (en/, hi/)
│   │   ├── lib/         mathGenerator, storyGenerator, …
│   │   ├── pages/       parent/ and child/ portal pages
│   │   ├── services/    api.ts (Axios)
│   │   ├── store/       Zustand stores (childStore, authStore, gameStore)
│   │   └── styles/      globals.css
├── server/              Express + Prisma backend
│   ├── prisma/          schema.prisma + migrations
│   ├── src/
│   │   ├── __tests__/   Vitest integration + unit tests
│   │   ├── lib/         pointCosts, pointsFormula, prisma, …
│   │   ├── middleware/  authMiddleware, rateLimiter
│   │   ├── routes/      auth, child, children, characters, reports
│   │   └── services/    reportBuilder, watsonxService
└── shared/              Types shared between client and server
```

See [`neurolexia-plan.md`](neurolexia-plan.md) for the full architecture, DB schema, and phase-by-phase implementation plan.

---

## Troubleshooting

### "Cannot reach server" / "server connection lost" on login or register

Work through these in order:

#### 1. `server/.env` is missing
```bash
cp server/.env.example server/.env
# Edit server/.env — at minimum set DB_URL, JWT_SECRET, WEBAUTHN_RP_ID, WEBAUTHN_ORIGIN
```

#### 2. The dev servers aren't running
```bash
npm run dev          # from workspace root — starts Vite and Express together
```
Do NOT open `index.html` directly — the app only works via `http://localhost:5173`.

#### 3. PostgreSQL isn't running
```bash
start-postgres.bat   # Windows embedded PostgreSQL
# or: pg_ctl start -D "C:\Program Files\PostgreSQL\16\data"
```

#### 4. The database isn't migrated
```bash
cd server
npx prisma migrate deploy
npm run db:seed
npm run seed:demo-parent
```

#### 5. Verify the server is running
```bash
curl http://localhost:3001/api/health
# Expected: {"status":"ok","env":"development","ts":"..."}
```

#### 6. Verify the Vite proxy
```bash
curl http://localhost:5173/api/health
# Should return the same {"status":"ok",...}
```

#### 7. Clear any stale VITE_API_URL
If you previously set `VITE_API_URL=http://localhost:3001` in `client/.env.local`, clear it to blank — the Vite proxy handles routing in development.

## Font Licenses

All web fonts are bundled in `client/public/fonts/` under the **SIL Open Font License 1.1** (OFL 1.1), which permits free use, redistribution, and bundling in applications.

| Font | Source package | License |
|---|---|---|
| OpenDyslexic Regular + Bold | `@fontsource/opendyslexic` v5.3.0 | SIL OFL 1.1 |
| Atkinson Hyperlegible Regular + Bold | `@fontsource/atkinson-hyperlegible` v5.1.1 | SIL OFL 1.1 |
| Noto Sans Devanagari Regular + Bold | `@fontsource/noto-sans-devanagari` v5.3.0 | SIL OFL 1.1 |

Full license text: https://openfontlicense.org/

---


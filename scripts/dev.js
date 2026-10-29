/**
 * scripts/dev.js
 * Single entry-point for `npm run dev`.
 * 1. Ensures PostgreSQL is running (Windows portable install).
 * 2. Spawns Vite (client) and ts-node-dev (server) concurrently.
 * Ctrl+C kills all child processes cleanly.
 */

const { spawn, execFileSync } = require('child_process');
const path = require('path');
const os = require('os');
const net = require('net');
const fs = require('fs');

// ── PostgreSQL paths (portable install) ───────────────────────────────────────
const PG_BIN  = path.join(os.homedir(), 'AppData', 'Local', 'pg-embedded',
  'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin');
const PG_DATA = path.join(os.homedir(), 'AppData', 'Local', 'pgdata-neurolexia');
const PG_CTL  = path.join(PG_BIN, 'pg_ctl.exe');
const PG_LOG  = path.join(PG_DATA, 'pg.log');

// ── Helpers ───────────────────────────────────────────────────────────────────
function isPortOpen(port) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(1500);
    s.on('connect', () => { s.destroy(); resolve(true); })
     .on('error',   () => { s.destroy(); resolve(false); })
     .on('timeout', () => { s.destroy(); resolve(false); })
     .connect(port, '127.0.0.1');
  });
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

const { existsSync } = require('fs');

// ── Colors ────────────────────────────────────────────────────────────────────
const CYAN   = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GREEN  = '\x1b[32m';
const RESET  = '\x1b[0m';

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Ensure PostgreSQL is running
  const pgUp = await isPortOpen(5432);
  if (pgUp) {
    console.log(`${GREEN}[pg]${RESET} PostgreSQL already running on :5432 ✓`);
  } else if (process.platform === 'win32' && existsSync(PG_CTL)) {
    console.log(`${GREEN}[pg]${RESET} Starting PostgreSQL...`);
    try {
      execFileSync(PG_CTL, ['-D', PG_DATA, '-l', PG_LOG, 'start'], { stdio: 'inherit' });
    } catch { /* pg_ctl exits non-zero if already running — ignore */ }
    // Wait up to 6 s
    for (let i = 0; i < 12; i++) {
      await wait(500);
      if (await isPortOpen(5432)) {
        console.log(`${GREEN}[pg]${RESET} PostgreSQL ready ✓`);
        break;
      }
      if (i === 11) {
        console.error(`[pg] PostgreSQL did not start. Check log: ${PG_LOG}`);
        process.exit(1);
      }
    }
  } else {
    console.log(`${GREEN}[pg]${RESET} Skipping PostgreSQL start (not Windows or pg_ctl not found).`);
  }

  // 2. Locate project root (where this script lives in /scripts)
  const root = path.resolve(__dirname, '..');

  // 3. Spawn Vite (client) — inherit stdio so output goes straight to terminal
  const vite = spawn(
    'npx', ['vite', '--port', '5173'],
    {
      cwd: path.join(root, 'client'),
      shell: true,
      stdio: 'inherit',
      env: { ...process.env },
    }
  );

  // 4. Spawn Express server (ts-node-dev)
  // Belt-and-suspenders: parse server/.env and inject vars explicitly so
  // the subprocess has them regardless of dotenv/config CWD resolution.
  const serverEnvFile = path.join(root, 'server', '.env');
  const serverEnv = { ...process.env };
  if (fs.existsSync(serverEnvFile)) {
    const lines = fs.readFileSync(serverEnvFile, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !(key in serverEnv)) serverEnv[key] = val; // don't override shell env
    }
    console.log(`${GREEN}[dev]${RESET} Loaded server/.env into subprocess environment.`);
  } else {
    console.warn(`${YELLOW}[dev]${RESET} server/.env not found — copy server/.env.example to server/.env and fill in values.`);
  }

  const server = spawn(
    'npx',
    ['ts-node-dev', '--respawn', '--transpile-only', '-r', 'tsconfig-paths/register', 'src/index.ts'],
    {
      cwd: path.join(root, 'server'),
      shell: true,
      stdio: 'inherit',
      env: serverEnv,
    }
  );

  // 5. Graceful shutdown on Ctrl+C
  function cleanup() {
    console.log('\n[dev] Shutting down...');
    vite.kill();
    server.kill();
    process.exit(0);
  }
  process.on('SIGINT',  cleanup);
  process.on('SIGTERM', cleanup);
  vite.on('exit',   (code) => { console.log(`[client] exited (${code})`); server.kill(); process.exit(code ?? 0); });
  server.on('exit', (code) => { console.log(`[server] exited (${code})`); vite.kill();   process.exit(code ?? 0); });

  console.log(`\n${GREEN}══════════════════════════════════════════${RESET}`);
  console.log(`${GREEN}  NeuroLexia dev servers starting...${RESET}`);
  console.log(`${CYAN}  Client${RESET} → http://localhost:5173`);
  console.log(`${YELLOW}  Server${RESET} → http://localhost:3001`);
  console.log(`${GREEN}══════════════════════════════════════════${RESET}\n`);
  console.log('  Press Ctrl+C to stop.\n');
}

main().catch(err => { console.error(err); process.exit(1); });

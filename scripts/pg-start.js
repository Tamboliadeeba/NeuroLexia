/**
 * scripts/pg-start.js
 * Ensures the portable PostgreSQL instance is running before dev servers start.
 * Called automatically by `npm run dev`.
 * Works on Windows only (this project's dev environment).
 */

const { execFileSync, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const net = require('net');

const PG_BIN = path.join(
  os.homedir(),
  'AppData', 'Local',
  'pg-embedded', 'node_modules',
  '@embedded-postgres', 'windows-x64', 'native', 'bin',
);
const PG_DATA = path.join(os.homedir(), 'AppData', 'Local', 'pgdata-neurolexia');
const PG_CTL  = path.join(PG_BIN, 'pg_ctl.exe');
const PG_LOG  = path.join(PG_DATA, 'pg.log');
const PG_PORT = 5432;

function isPortOpen(port) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(1500);
    sock
      .on('connect', () => { sock.destroy(); resolve(true); })
      .on('error',   () => { sock.destroy(); resolve(false); })
      .on('timeout', () => { sock.destroy(); resolve(false); })
      .connect(port, '127.0.0.1');
  });
}

async function main() {
  // Skip on non-Windows (CI, Linux, etc.)
  if (process.platform !== 'win32') return;

  const alreadyUp = await isPortOpen(PG_PORT);
  if (alreadyUp) {
    console.log('[pg-start] PostgreSQL already running on port 5432 ✓');
    return;
  }

  const { existsSync } = require('fs');
  if (!existsSync(PG_CTL)) {
    console.error('[pg-start] pg_ctl not found at:', PG_CTL);
    console.error('[pg-start] Run start-postgres.bat manually, then retry npm run dev.');
    process.exit(1);
  }

  console.log('[pg-start] Starting PostgreSQL...');
  try {
    execFileSync(PG_CTL, ['-D', PG_DATA, '-l', PG_LOG, 'start'], { stdio: 'inherit' });
  } catch {
    // pg_ctl returns non-zero if already running — check port again
    const upNow = await isPortOpen(PG_PORT);
    if (!upNow) {
      console.error('[pg-start] Failed to start PostgreSQL. Check log:', PG_LOG);
      process.exit(1);
    }
  }

  // Wait up to 5 s for port to open
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await isPortOpen(PG_PORT)) {
      console.log('[pg-start] PostgreSQL ready ✓');
      return;
    }
  }
  console.error('[pg-start] PostgreSQL did not become ready in time. Check log:', PG_LOG);
  process.exit(1);
}

main();

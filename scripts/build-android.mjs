// Builds the web bundle, syncs Capacitor and runs Gradle. Usage: node scripts/build-android.mjs debug|release
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const variant = process.argv[2] === 'release' ? 'Release' : 'Debug';
const isWin = process.platform === 'win32';
const npx = isWin ? 'npx.cmd' : 'npx';

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: isWin, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run(npx, ['vite', 'build']);
run(npx, ['cap', 'sync', 'android']);
if (!existsSync('android/gradlew')) {
  console.error('android/ project missing; run "npx cap add android" first.');
  process.exit(1);
}
run(isWin ? 'gradlew.bat' : './gradlew', [`assemble${variant}`], { cwd: 'android' });

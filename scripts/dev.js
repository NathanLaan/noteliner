const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';

// Start Vite dev server.
// `detached: true` on Unix makes the shell a process-group leader, so we can
// later signal the whole group (shell + npx + vite) at once. Without this,
// killing the shell leaves npx+vite orphaned and holding port 5250.
const vite = spawn('npx', ['vite'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'pipe',
  shell: true,
  detached: !isWindows,
});

let viteKilled = false;
function killVite() {
  if (viteKilled || !vite.pid) return;
  viteKilled = true;
  try {
    if (isWindows) {
      // Windows: taskkill recursively terminates the child tree
      spawn('taskkill', ['/pid', String(vite.pid), '/f', '/t']);
    } else {
      // Unix: negative PID = signal the entire process group
      process.kill(-vite.pid, 'SIGTERM');
    }
  } catch {
    // Process already gone — fine
  }
}

vite.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);

  // When Vite is ready, launch Electron
  if (output.includes('Local:')) {
    console.log('\nStarting Electron...\n');
    const electron = spawn('npx', ['electron', '.'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, NODE_ENV: 'development' }
    });

    electron.on('close', () => {
      killVite();
      process.exit();
    });
  }
});

vite.stderr.on('data', (data) => {
  process.stderr.write(data);
});

vite.on('close', (code) => {
  process.exit(code);
});

// Ensure Vite is cleaned up no matter how dev.js itself exits
process.on('SIGINT', () => { killVite(); process.exit(0); });
process.on('SIGTERM', () => { killVite(); process.exit(0); });
process.on('exit', killVite);

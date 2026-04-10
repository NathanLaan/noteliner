const { spawn } = require('child_process');
const path = require('path');

// Start Vite dev server
const vite = spawn('npx', ['vite'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'pipe',
  shell: true
});

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
      vite.kill();
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

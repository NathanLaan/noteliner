#!/usr/bin/env node
// Generates a synthetic NoteLiner project on disk for benchmarking.
//
// Output is intentionally machine-flavored: names like "Note 0001", tags like
// "tag-a", body text built from repeated filler tokens. The bench measures
// structure and sizes (file count, body length, link density), not realism.
//
// Usage: node scripts/bench/generate-vault.js <out-dir> <n-notes> [seed]

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const TAG_POOL = Array.from({ length: 30 }, (_, i) =>
  'tag-' + String.fromCharCode(97 + (i % 26)) + (i < 26 ? '' : Math.floor(i / 26)));

const FILLER = 'aa bb cc dd ee ff gg hh ii jj kk ll mm';

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223;
    s = s >>> 0;
    return s / 0x100000000;
  };
}

function pad(n, width) {
  return String(n).padStart(width, '0');
}

function generate(outDir, n, seed) {
  const rand = rng(seed);
  const width = String(n).length;

  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  const files = [];
  for (let i = 1; i <= n; i++) {
    const num = pad(i, width);
    files.push({
      id: crypto.randomUUID(),
      name: 'Note ' + num,
      filename: 'note-' + num + '.md',
      parentId: null,
      order: i - 1,
      tags: [],
      attachments: [],
    });
  }

  // ~30% nested, parent must precede the child to keep parentId valid.
  for (let i = 1; i < files.length; i++) {
    if (rand() < 0.3) {
      const parentIdx = Math.floor(rand() * i);
      files[i].parentId = files[parentIdx].id;
    }
  }

  // 1-3 tags from the pool.
  for (const f of files) {
    const k = 1 + Math.floor(rand() * 3);
    const used = new Set();
    while (used.size < k) used.add(TAG_POOL[Math.floor(rand() * TAG_POOL.length)]);
    f.tags = [...used];
  }

  // Bodies: a heading + several filler paragraphs. ~5% wikilink density.
  for (const f of files) {
    const paras = ['# ' + f.name];
    const numParas = 5 + Math.floor(rand() * 15);
    for (let p = 0; p < numParas; p++) {
      // Each paragraph: filler repeated some number of times.
      const reps = 4 + Math.floor(rand() * 8);
      let para = (FILLER + ' ').repeat(reps).trim();
      if (rand() < 0.05) {
        const target = files[Math.floor(rand() * files.length)];
        para += ' [[' + target.name + ']]';
      }
      paras.push(para);
    }
    fs.writeFileSync(path.join(outDir, f.filename), paras.join('\n\n') + '\n');
  }

  fs.writeFileSync(
    path.join(outDir, 'noteliner.json'),
    JSON.stringify({ version: 2, files }, null, 2)
  );

  // Single bulk git commit so the vault opens like a real project.
  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Bench',
    GIT_AUTHOR_EMAIL: 'bench@example.com',
    GIT_COMMITTER_NAME: 'Bench',
    GIT_COMMITTER_EMAIL: 'bench@example.com',
  };
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: outDir, env: gitEnv });
  execFileSync('git', ['add', '-A'], { cwd: outDir, env: gitEnv });
  execFileSync('git', ['commit', '-q', '-m', 'Bench vault'], { cwd: outDir, env: gitEnv });
}

function main() {
  const [, , outDir, nStr, seedStr] = process.argv;
  if (!outDir || !nStr) {
    process.stderr.write('Usage: node scripts/bench/generate-vault.js <out-dir> <n-notes> [seed]\n');
    process.exit(1);
  }
  const n = parseInt(nStr, 10);
  const seed = parseInt(seedStr || '42', 10);
  if (!Number.isFinite(n) || n <= 0) {
    process.stderr.write('n-notes must be a positive integer\n');
    process.exit(1);
  }
  const t0 = Date.now();
  generate(outDir, n, seed);
  process.stdout.write('Generated ' + n + ' notes in ' + outDir + ' in ' + (Date.now() - t0) + 'ms\n');
}

main();

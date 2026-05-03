// Lightweight perf instrumentation.
//
// Disabled unless NOTELINER_BENCH=1 is set. When NOTELINER_BENCH_LOG points at
// a file path, every completed measurement is appended as a single JSON line:
//   {"ts":1714587322000,"name":"project.open","ms":312.4,"meta1":...}
//
// The bench runner reads that file after a run to summarize timings.

const fs = require('fs');

const enabled = !!process.env.NOTELINER_BENCH;
const logPath = process.env.NOTELINER_BENCH_LOG;
const marks = new Map();

function start(name) {
  if (!enabled) return;
  marks.set(name, performance.now());
}

function end(name, meta) {
  if (!enabled) return 0;
  const t0 = marks.get(name);
  if (t0 === undefined) return 0;
  const ms = performance.now() - t0;
  marks.delete(name);
  if (logPath) {
    try {
      fs.appendFileSync(
        logPath,
        JSON.stringify({ ts: Date.now(), name, ms, ...(meta || {}) }) + '\n'
      );
    } catch { /* never let perf logging break the app */ }
  }
  return ms;
}

async function measure(name, fn, meta) {
  if (!enabled) return await fn();
  start(name);
  try {
    return await fn();
  } finally {
    end(name, meta);
  }
}

module.exports = { start, end, measure, enabled };

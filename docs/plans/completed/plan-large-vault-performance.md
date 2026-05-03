# Large-Vault Performance Pass — Implementation Plan

## Overview

Measure NoteLiner's behavior on synthetic vaults of 1k / 5k / 10k notes,
identify the operations that degrade, and apply targeted fixes. The goal is
**evidence**: a checked-in benchmark, baseline numbers, and a documented
target ("project open under 2s at 10k notes; search keystroke under 50ms").

This is the boring, load-bearing item from the comparison report — it
converts NoteLiner from "BETA, my personal use" to "you can trust it with
your real notes."

## Goals

1. A reproducible benchmark suite that anyone can run in under five minutes.
2. Documented baseline numbers for 100 / 1k / 5k / 10k notes across the
   user-visible operations: project open, file tree render, search query,
   note open, note save, link-graph rebuild.
3. Performance targets per operation. Anything that exceeds the target is
   either fixed in this plan or filed as a known gap with a deferral
   reason.
4. A regression alarm — not CI gating, but a script that prints "open went
   from 280ms to 950ms" so we *notice* if a change blows up performance.

## Current State

- **No benchmarks exist.** Test infrastructure is also absent (see
  `plan-playwright-smoke-tests.md`).
- **Project open path:** `openProject` (`project-service.js:31`) does
  `git pull` (synchronous in the user's eyes), reads `noteliner.json`
  (single sync read), runs `migrateIndex`, returns. No per-file work, so
  the index size dominates.
- **File tree:** `FileTree.svelte` renders all entries in one pass — no
  virtualization. At 10k entries, this is 10k DOM nodes.
- **Search:** `searchService.query` (per `preload.js:48`) reads files on
  every query — there is no persistent index. Plan exists in
  `plan-search-index.md`.
- **Link graph:** `link-graph-service.js` rebuilds by reading every note
  and regex-matching wikilinks. Synchronous reads, sync regex.
- **Auto-commit:** `gitService.commit` runs after every save and is
  serialized — not directly affected by vault size, but a flurry of writes
  (e.g., from MCP) gets serialized.

## Operations and Targets

| Operation | Frequency | Target @ 10k notes |
|---|---|---|
| Project open (cold, no remote pull) | Once per session | < 2,000 ms |
| Project open (with `git pull`, fast network) | Once per session | < 4,000 ms |
| Initial file-tree render | Once per project open | < 500 ms |
| Switch selected note (load body into editor) | Many per minute | < 100 ms |
| Save current note | Every keystroke (debounced) | < 50 ms perceived (commit can be async) |
| Search keystroke (within `SearchPane`) | Every keystroke | < 50 ms |
| Link-graph full rebuild | Every project open | < 1,000 ms |
| Backlinks lookup | On every selection change | < 30 ms |
| Frontmatter reconciliation (one-time) | First open after upgrade | < 5,000 ms |

These are user-perceived targets. Memory is a separate axis — track resident
set but don't gate on it for v1.

## Benchmark Harness

### Synthetic vault generator

**New file:** `scripts/bench/generate-vault.js`

```js
// Usage: node scripts/bench/generate-vault.js <out-dir> <n-notes>
// Creates <out-dir> with N notes, ~30% nested, realistic body sizes
// (mean 800 words), 1-3 tags each, 5% wikilink density.
```

Generator notes:

- Bodies use lorem-ipsum-ish text + occasional headers, lists, code blocks
  to exercise the markdown parser realistically.
- Wikilinks reference random other notes by name; ~5% of paragraphs
  contain a `[[Other Note]]`.
- Tag pool of ~30 tags; each note picks 1–3.
- Output is a valid NoteLiner project (writes `noteliner.json`, runs
  `git init`, makes one big commit).
- Deterministic via `--seed N` flag so re-runs yield identical vaults.

Sizes shipped: `noteliner-bench-100`, `-1k`, `-5k`, `-10k`. Generated
on demand, not checked into the repo.

### Benchmark runner

**New file:** `scripts/bench/run-bench.js`

Driven by Playwright (reuses the harness from
`plan-playwright-smoke-tests.md` if it lands first). For each operation:

1. Launch app with `--bench-vault <path>`.
2. Wait for ready event from a small instrumentation hook (see "Telemetry"
   below).
3. Trigger the operation programmatically.
4. Record the wall time.
5. Repeat 5×, drop best+worst, report mean of remaining 3.

Output is a JSON file plus a markdown table written to
`docs/bench/results-{date}.md`.

### Telemetry hooks (opt-in)

Add a thin `perf` module in main:

```js
// src/main/perf.js
const marks = new Map();
function start(name) { marks.set(name, performance.now()); }
function end(name) {
  const t = performance.now() - marks.get(name);
  marks.delete(name);
  if (process.env.NOTELINER_BENCH) {
    process.stdout.write(`PERF ${name} ${t.toFixed(1)}\n`);
  }
  return t;
}
```

Sprinkle around the operations of interest:

```js
perf.start('project.open');
// ...
perf.end('project.open');
```

Production builds default `NOTELINER_BENCH` off; `0` runtime cost when
unset (one env var lookup, one `Map.set` discarded).

### Baseline document

**New file:** `docs/bench/baseline.md`

Holds the most recent set of measurements:

```
| Op                      | 100   | 1k    | 5k     | 10k    | Target  |
|-------------------------|-------|-------|--------|--------|---------|
| project.open            | 80ms  | 130ms | 380ms  | 720ms  | <2000ms |
| filetree.render         | ...   |       |        |        |         |
```

Updated whenever the runner is rerun. The bench script can `--diff` against
the previous baseline and print regressions.

## Likely Hotspots and Targeted Fixes

The following are educated guesses — measure first, fix second. Do not
preemptively implement these.

### Hotspot A: FileTree render at 10k entries

**Symptom:** initial render is slow; scrolling is janky.

**Fix:** virtualize the tree. Render only the visible window
(~50 rows + buffer). Svelte 5's `$effect` makes this easy: track scroll
position, slice `flattenedTree` accordingly. ~80 lines in `FileTree.svelte`.

Defer until the bench shows it's needed. At 1k notes virtualization is
overkill; at 10k it likely matters.

### Hotspot B: Link-graph rebuild scans every file

**Symptom:** open is fast for the index but link graph adds 1–3s.

**Fixes (in order of cost):**

1. **Parallelize file reads.** Promise.all over `fs.readFile`. Saves ~2x
   on cold cache.
2. **Skip files unchanged since last open** — persist a `linkGraph` cache
   in `userData` keyed by `(filename, mtime, size)`. Recompute only files
   whose stat differs. Most opens hit ~100% cache.
3. **Worker thread.** If still slow, move scanning to a `worker_threads`
   worker. Highest cost; only if 1+2 isn't enough.

### Hotspot C: Search reads every file every keystroke

**Symptom:** typing in search lags noticeably.

**Fix:** persistent inverted index per `plan-search-index.md`. That plan
already exists; this benchmark gives it a measurable target (50ms per
keystroke at 10k notes).

### Hotspot D: `git commit` per save

**Symptom:** rapid typing → many commits queued → push backlog grows.

**Fixes:**

1. Already debounced (500ms write debounce in editor → coalesces).
2. Coalesce commits within a window: if a commit fires within 2s of the
   previous, **amend** it rather than create a new commit. (`git commit
   --amend --no-edit`.) Avoids history pollution.
3. Document the amend window in the README so users aren't surprised.

### Hotspot E: `noteliner.json` rewritten on every change

**Symptom:** a 10k-entry index serialized with `JSON.stringify(... null, 2)`
is ~2MB. Writing 2MB on every keystroke is wasteful (even debounced).

**Fix:** only rewrite the index when an *index field* changes (rename,
reparent, tag change, attachment add). Body edits do not touch the index.
Audit the existing call sites — there may already be paths that don't
need to rewrite.

If still slow, switch the index to JSON-Lines (one note per line) so a
single-note change is an in-place patch — out of scope for v1; mention if
the bench shows it dominates.

## Implementation Steps

### Step 1: Build the harness (no fixes yet)

1. Add `scripts/bench/generate-vault.js`.
2. Add `scripts/bench/run-bench.js`.
3. Add `src/main/perf.js` with marks + env-gated stdout.
4. Add hooks at the operation points listed above.
5. Run on 100 / 1k / 5k / 10k. Commit `docs/bench/baseline.md`.

This is the first PR. Outcome: numbers in tree, no behavior change.

### Step 2: Read results, file targets

For each op that exceeds its target, decide:

- **Fix in this plan** (if cheap and the target matters).
- **Defer to a follow-up plan** (if expensive — e.g. tree virtualization
  worth its own plan).
- **Loosen the target** (if the user-perceived impact is actually fine
  and the target was over-tight).

Document the decision per op in `docs/bench/baseline.md`.

### Step 3: Apply targeted fixes

Each fix lands as its own PR with a before/after row in
`docs/bench/baseline.md`. PR description includes:

- The op being fixed
- The hotspot identified by the benchmark
- The numbers (before, after, target)

### Step 4: Add `npm run bench`

```json
"scripts": {
  "bench:gen": "node scripts/bench/generate-vault.js",
  "bench:run": "node scripts/bench/run-bench.js",
  "bench": "npm run bench:gen -- /tmp/noteliner-bench-10k 10000 && npm run bench:run -- /tmp/noteliner-bench-10k"
}
```

Document in README under "Development."

### Step 5: Regression check (optional)

A `bench:diff` script that compares current run to checked-in baseline and
exits non-zero if any op regressed by > 25% or exceeded its target.
**Do not gate CI on this** — measurement noise + cold-cache variance will
flake. Use it as a manual pre-release check.

## Edge Cases

- **Cold vs warm filesystem cache** dominates the first run. Always run
  bench twice; report the second number. Document this caveat.
- **Antivirus on Windows** can add 100ms+ per file open. Document; do not
  try to "fix."
- **HDD vs SSD:** target numbers assume SSD. If we ever care about HDD
  users, add a separate baseline column.
- **Electron version drift:** numbers can shift with Electron upgrades.
  Note the Electron version in each baseline file.
- **`git pull` over slow network:** Tagged separately from "open cold,
  no pull" so the network can't mask local regressions.

## Testing

The benchmarks themselves *are* the test. Additional sanity:

1. Generate a 100-note vault, open it in the dev build, exercise every
   feature manually — ensures the generator produces a valid project.
2. Generate a 10k-note vault, open it. App must not freeze the UI thread
   for more than 250ms continuously (look for jank in dev tools).
3. Run `npm run bench` end-to-end. JSON file appears, baseline.md updates
   with diff arrows.

## Out of Scope (this plan)

- **Memory profiling.** Track RSS but don't optimize for it.
- **Network-side performance** (push, pull) — that's a separate axis.
- **Concurrency stress** (many MCP writes/sec). Out of scope; revisit when
  MCP server lands.
- **Tree virtualization** if the bench shows it's needed → follow-up plan.
- **Worker-thread offload** for link graph if the bench shows it's needed
  → follow-up plan.

## Rollout

No user-facing changes from Step 1. Subsequent fix-PRs are individually
shippable. Baseline document is the audit trail.

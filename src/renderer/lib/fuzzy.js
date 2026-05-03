// Tiny fuzzy matcher for the command palette. Returns 0 for "no match,"
// otherwise a positive score where higher = better.
//
// Scoring tiers (rough):
//   prefix exact        ~ 1000
//   contains substring  ~ 500 - position
//   subsequence + word-boundary boosts
//
// Empty pattern returns 1 so all entries appear unsorted.

export function fuzzyScore(target, pattern) {
  if (!pattern) return 1;
  if (!target) return 0;
  const t = target.toLowerCase();
  const p = pattern.toLowerCase();

  if (t.startsWith(p)) return 1000 + (target.length - pattern.length === 0 ? 100 : 0);

  const idx = t.indexOf(p);
  if (idx >= 0) return 500 - idx;

  // Subsequence match.
  let score = 0;
  let pi = 0;
  let matched = 0;
  for (let i = 0; i < t.length && pi < p.length; i++) {
    if (t[i] !== p[pi]) continue;
    matched++;
    pi++;
    const prev = i === 0 ? ' ' : t[i - 1];
    const isBoundary = prev === ' ' || prev === '-' || prev === '_' || prev === '.' || prev === '/';
    score += isBoundary ? 12 : 2;
  }
  if (pi < p.length) return 0;
  // Penalize long targets where the match is sparse.
  return Math.max(1, score - Math.floor((t.length - matched) / 8));
}

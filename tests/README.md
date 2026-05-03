# Tests

End-to-end smoke tests for NoteLiner using [Playwright](https://playwright.dev/)
to drive the real Electron app against a real filesystem and a real git repo.

## Mandate

Five tests, total. Not comprehensive coverage — just enough to catch
regressions in the load-bearing paths:

1. `01-boot.spec.js` — app launches and renders the open screen.
2. `02-create-and-persist.spec.js` — create a note, write a body, verify
   the file, the index, and at least two git commits on disk.
3. `03-rename.spec.js` — rename preserves content and produces a commit.
4. `04-delete.spec.js` — delete removes the file from disk and from the
   index, and produces a commit.
5. `05-attachment.spec.js` — attachments land in `_attachments/` and in
   the index.

If the suite grows past 7–8 tests, ask whether the new test catches a
distinct failure mode the existing five would miss. Otherwise prefer to
reinforce existing tests rather than add new ones.

## Running

```
npm test            # run the suite headlessly
npm run test:headed # run with the Electron window visible
npm run test:debug  # step through with Playwright Inspector
```

Tests require the renderer to be built (`npm run build`). The CI workflow
builds first; locally, run `npm run build` once after pulling renderer
changes.

## How it works

`fixtures.js` launches Electron via `_electron.launch` with:

- `--user-data-dir=<tmp>` — isolates `noteliner.json` cache, recents,
  ui-preferences from the real install.
- `NODE_ENV=test` — main loads the built `dist/` (not the dev server) and
  appends `?test=1` to the renderer URL.
- `GIT_AUTHOR_*` / `GIT_COMMITTER_*` env vars — git commits work without
  touching the user's `~/.gitconfig`.

The renderer, on seeing `?test=1`, installs `window.__nlTest` — a small
helper namespace that composes the same IPC + project-store updates the
real UI does. Tests call `__nlTest.initProject(...)`,
`__nlTest.createFile(...)`, etc. and then assert against on-disk state.

## What we don't test here

- Unit-level logic (frontmatter parsing, link graph, etc.) — when those
  exist, they belong in `tests/unit/` with a different runner.
- Performance — see `docs/plans/future/plan-large-vault-performance.md`.
- Visual regression / screenshot diffing — too maintenance-heavy for the
  payoff at NoteLiner's size.

# Plan: New Features for NoteLiner

Three proposed features that span functionality, performance, utility, and UX, chosen to fit NoteLiner's existing architecture rather than require a rewrite.

---

## Framing

Each suggestion below is scoped to *fit what's already there* — leveraging `marked`, `project-service.js`, `noteliner.json`, and the existing pane system — not to require an architecture change. A feature that needs an architecture change is usually a feature that won't ship.

The app already nails *file organization* (hierarchical tree, drag-reorder, tags, tag groups) and *version control* (auto-commit, push/pull, history panel). Piling more into those areas would be marginal. The biggest deltas are in:

- **Knowledge-connection** — no wikilinks/backlinks
- **Search at scale** — linear scan across every `.md` on every keystroke
- **Rich content** — no diagram or math rendering despite a preview pipeline that already uses `marked`

---

## Feature 1 — Wikilinks `[[Note Name]]` + Backlinks pane

**Category:** Functionality + UX (the transformative pick)

**What it does:** When you type `[[` in the editor, a popup autocompletes from existing note names. The preview renders `[[Some Note]]` as a clickable link that opens that note (or offers to create it if missing). A new **Backlinks** pane (peer to Outline/Tags/Search) shows every note that links *into* the currently open note.

**Why it fits NoteLiner specifically:**

- The app already has stable file IDs in `noteliner.json` (tracks `id`, `name`, `filename`, `parentId`, `tags`, `attachments`). Link resolution can key off `name` (human-visible) while storing the `id` in a cached link graph — so renames don't break links.
- The pane infrastructure is already generalized (`Outline`, `Tags`, `TagGroups`, `Search` all follow the same pattern with `paneOrder` in layout). Adding a Backlinks pane is a data-plus-component addition, not a layout rewrite.
- The Preview pipeline uses `marked`, which supports custom tokenizers. A wikilink extension is ~40 lines.

**Implementation sketch:**

1. **Link index in `project-service.js`**: on project load, scan every `.md` for `\[\[([^\]]+)\]\]`, build a `Map<fileId, Set<fileId>>` of outgoing and incoming links. Update incrementally on save.
2. **Editor autocomplete**: CodeMirror's `autocompletion` extension triggered on `[[`, fed from `projectState.index.files.map(f => f.name)`.
3. **Preview rendering**: `marked` extension that turns `[[Foo]]` into `<a data-wikilink="Foo">Foo</a>`; the Preview's click handler resolves name → file and calls `projectState.selectFile(id)`.
4. **Backlinks pane**: a simple `$derived` over the link index keyed by `projectState.selectedFile.id`.

**Effort:** ~1–2 days. The riskiest piece is rename-handling (a note renamed from "Foo" to "Bar" needs either link rewriting or name-independent resolution). Start with name-based resolution and warn on rename.

**Why this feature, not some other "power user" one:** Without wikilinks, a folder of markdown files is a filing cabinet. With them, it's a knowledge base. This is *the* feature that separates Obsidian/Logseq from plain text editors — and NoteLiner is already 80% of the way there structurally. It's the largest unlock per line of code.

---

## Feature 2 — SQLite FTS5 search index

**Category:** Performance + Utility (scales the app to 10k+ notes)

**What it does:** Replace the current linear, line-by-line scan in `project-service.js search()` with a persistent SQLite FTS5 virtual table. Adds ranked results (BM25), snippet highlighting, prefix search (`lin*`), phrase queries (`"exact phrase"`), and field-scoped queries (`tag:research foo`). The 300ms debounce in `SearchPane.svelte` becomes invisible because query latency drops from O(total bytes) to O(log n).

**Why it fits NoteLiner specifically:**

- Electron bundles SQLite support via `better-sqlite3` (a single native module add). No server, no external service.
- The index can live inside the project folder as `.noteliner/search.db` — portable with the project (like `noteliner.json`), git-ignored, rebuildable from source at any time.
- Reuses existing hooks: `project-service.writeFile` already fires on save (that's where auto-commit runs); adding `fts.upsert(fileId, content)` in the same path is a two-line change.
- The current search UI (results grouped by file with line numbers in `SearchPane.svelte:91-105`) continues to work unchanged — FTS just feeds it better results faster.

**Implementation sketch:**

1. Add `better-sqlite3` dependency, initialize `search.db` on project open with:
   ```sql
   CREATE VIRTUAL TABLE notes USING fts5(
     file_id UNINDEXED,
     name,
     content,
     tokenize='porter unicode61'
   );
   ```
2. On project open, if the DB is missing or stale (compare `.noteliner.json` mtime), do a one-time bulk rebuild.
3. Hook `project-service.writeFile` and `removeFile` to `INSERT OR REPLACE` / `DELETE FROM notes WHERE file_id = ?`.
4. Replace `projectService.search()` body with:
   ```sql
   SELECT file_id,
          snippet(notes, 2, '<mark>', '</mark>', '…', 20) AS snippet,
          bm25(notes) AS rank
   FROM notes
   WHERE notes MATCH ?
   ORDER BY rank
   LIMIT 200;
   ```
5. Teach `SearchPane.svelte` to render the `<mark>`-tagged snippets with the existing accent color (`var(--accent)`).

**Effort:** ~2–3 days, with most of it in testing the rebuild/drift path. The payoff grows super-linearly with note count.

**Why this one, not "add regex search":** Regex is 5 lines on top of the current linear scan and papers over the real bottleneck. FTS5 fixes the bottleneck *and* gives you ranking, snippets, and field queries as free byproducts. Regex can layer on afterward via FTS5's custom tokenizer or a fallback path.

---

## Feature 3 — Mermaid diagrams + KaTeX math in preview & export

**Category:** UX + Utility (quick win, high visibility)

**What it does:** Fenced code blocks tagged `mermaid` render as SVG diagrams in the Preview pane, the History pane's preview, the HTML export, and the PDF export. Inline `$...$` and block `$$...$$` math renders via KaTeX in the same four surfaces.

**Why it fits NoteLiner specifically:**

- The preview pipeline is already `marked(...)` → `innerHTML` (`Preview.svelte:49`, `HistoryPanel.svelte`). KaTeX and Mermaid both ship as `marked` extensions / post-processors — no rewrite.
- The HTML/PDF export already bakes CSS into the output (`main.js:434-445`). The same pattern extends to bundling KaTeX CSS and Mermaid's already-inlined SVG, so the exports render identically to the preview.
- A huge chunk of real-world markdown — engineering notes, design docs, architecture sketches, math/physics notes — hits the floor when diagrams and formulas don't render. This gap is disproportionately visible.
- The "Save to PDF" feature (already shipped) becomes dramatically more useful for technical notes when Mermaid/KaTeX render in the exported PDF.

**Implementation sketch:**

1. Add `marked-katex-extension` and `mermaid` as dependencies.
2. In `Preview.svelte` (and `HistoryPanel.svelte`), `marked.use(katex())` once at module load. After `@html html`, call `mermaid.run({ nodes: previewContentEl.querySelectorAll('pre > code.language-mermaid') })`.
3. In the main-process HTML/PDF handlers (`main.js:424`, `:463`), do the same `marked.use(katex())` plus a `mermaid.renderAsync()` substitution step before wrapping in the `<html>` template. Inline KaTeX's CSS into the export's `<style>` block.
4. Mermaid themes: pick `theme: 'default'` for Light family, `'dark'` for Dark family — read from `themeState.current` (or fall back to `default` in main-process export since the exported file doesn't need to match the app's runtime theme).

**Effort:** ~1 day for preview, +half a day for HTML/PDF export parity, +half a day for theme-aware Mermaid rendering.

**Why this one, not "spellcheck" or "word count":** Spellcheck is a solved problem (Electron ships it natively — one-line enable on the `<textarea>`-equivalent, though CodeMirror makes it slightly trickier). Word count is a 15-minute addition you can do anytime. Mermaid + KaTeX is the feature that makes NoteLiner feel *complete* for technical writers, and it piggybacks cleanly on infrastructure you already have.

---

## Why these three together

- **Wikilinks** changes *what the app is* (filing cabinet → knowledge graph). **FTS5** changes *how well it scales* (100 notes → 10k+). **Mermaid/KaTeX** changes *what content it handles gracefully* (prose-only → technical writing). The three have almost no overlap — shipping all three gives three independent step-changes in capability.
- They also stack well: wikilinks + FTS5 means "search for notes that link to foo AND mention 'rebalancing'" becomes possible with a small query extension. FTS5 + Mermaid means PDFs are both searchable and visually complete.
- Each is *self-contained* — any one could ship independently and deliver value on its own. If only one fits the roadmap, pick **wikilinks + backlinks** because it's the single feature most likely to change how often someone reaches for NoteLiner in the first place.

---

## Honorable mentions (considered and cut)

- **Soft delete / trash** — legitimately useful (currently `Delete` is permanent per `DeleteFileModal.svelte`), but partially mitigated by git history. Lower-value than the picks above.
- **Daily notes + templates** — great quality-of-life for journalers, but narrower audience than the three above.
- **Tabs for multiple open files** — nice UX, but a large refactor of `projectState.selectedFile` (single-file state today).
- **Table editor UI** — genuine pain point, but niche. Markdown tables are annoying but workable.

---

## Suggested ordering if shipping sequentially

1. **Mermaid + KaTeX** first — lowest effort, highest immediate visual payoff, proves out export parity.
2. **Wikilinks + Backlinks** second — the identity-defining feature; gives the app a reason to exist beyond "a folder of markdown files with a nice editor."
3. **FTS5 search** third — the feature that matters most *after* you have thousands of notes, which is the same moment users notice the current linear search slowing down.

This order lets each feature compound the last: rich content first (so there's more reason to keep notes), then connectivity (so the growing corpus becomes a graph), then search-at-scale (so the graph stays navigable).

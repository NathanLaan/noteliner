# Full-Text Search Index (SQLite FTS5)

## Overview

Replace the current linear, per-query file scan with a persistent SQLite FTS5 virtual table. Adds ranked results (BM25), inline snippet highlighting, prefix search (`plan*`), phrase queries (`"exact phrase"`), and field-scoped queries (`tag:research foo`). Query latency drops from O(total content) to roughly O(log n) on a tokenized vocabulary, making search feel instant even on 10k-note projects.

The existing `SearchPane.svelte` UI keeps its layout and debounce unchanged — FTS just feeds it faster, ranked, pre-highlighted results.

## Current State

- **Search implementation:** `project-service.js:286-317`. On every query, every `.md` file is read from disk, split into lines, and `String.includes()` is checked per line. For a 1000-note repo, this reads ~tens of MB on every keystroke past the 300ms debounce.
- **UI:** `SearchPane.svelte` debounces 300ms, groups results by file, renders matches with 1-based line numbers.
- **Options surfaced:** `caseSensitive` (boolean), nothing else.
- **Persistence:** None — the index is rebuilt implicitly on every query.
- **No dependency on SQLite** currently; must add `better-sqlite3`.

## Design

### Storage location

```
<project>/.noteliner/search.db          ← the SQLite database
<project>/.noteliner/search.meta.json   ← { indexVersion, fileCount, lastBuildMs }
<project>/.gitignore                    ← add ".noteliner/" if not present
```

Placing the DB inside the project folder (not in userData) means the index is:
- **Portable** with the project if copied (but rebuildable if it isn't).
- **Gitignored** — never committed, never syncs across machines (rebuild is cheap and per-machine native binaries differ anyway).
- **Per-project** — no global DB to corrupt multiple projects at once.

### Schema

```sql
CREATE VIRTUAL TABLE notes USING fts5(
  file_id UNINDEXED,
  name,
  tags,
  content,
  tokenize='porter unicode61 remove_diacritics 1'
);

CREATE TABLE index_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
-- stores: schema_version, last_full_rebuild_at
```

**Why these columns:**
- `file_id` is UNINDEXED — it's just a join key into `noteliner.json`; we don't want to tokenize UUIDs.
- `name` is separate from `content` so we can weight filename matches higher and support `name:foo` queries.
- `tags` is a space-separated denormalization of the tag array so `tag:research` can become `tags:research` internally.
- `tokenize='porter unicode61 remove_diacritics 1'` — porter stemmer for English word variants, unicode61 for Unicode handling, diacritic folding so `café` matches `cafe`.

### Query translation

User types: `tag:research performance`
App runs: `SELECT ... WHERE notes MATCH 'tags:research performance'`

User types: `"exact phrase"`
App runs: `SELECT ... WHERE notes MATCH '"exact phrase"'`

User types: `plan*`
App runs: `SELECT ... WHERE notes MATCH 'plan*'`

A lightweight query translator in the main process handles the `tag:` alias and validates the query (FTS5 rejects malformed MATCH expressions). If translation/validation fails, fall back to a literal phrase search: `MATCH '"<user query>"'`.

### Ranking and snippets

```sql
SELECT
  file_id,
  name,
  snippet(notes, 3, '<mark>', '</mark>', '…', 20) AS snippet,
  bm25(notes, 10.0, 5.0, 3.0, 1.0) AS rank
FROM notes
WHERE notes MATCH ?
ORDER BY rank
LIMIT 200;
```

BM25 column weights (`name=10, tags=5, content=3`) mean a hit in the filename dominates a hit in body text, which matches intuition. `file_id` weight is `1.0` but it's UNINDEXED so it never matches anyway.

Line numbers are *not* returned by FTS5 directly — a snippet is a text window, not a line locator. Two options:
1. **Drop line numbers** from results. The snippet alone is more useful than a line number without context.
2. **Post-process snippets** to compute the line number by reading the file once per result. Adds I/O but stays under 200 files.

V1 ships (1) — snippets are better UX. If users miss line numbers, (2) is a cheap follow-up.

### Rebuild and drift detection

On project open:

```
if .noteliner/search.db missing          → full rebuild
else if meta.schema_version mismatch     → full rebuild
else if meta.fileCount != index.files.length  → rebuild-on-open (conservative)
else                                     → trust the DB, proceed
```

Rebuild is incremental per file: read content, `INSERT OR REPLACE INTO notes VALUES (?, ?, ?, ?)`. A 10k-note project rebuilds in ~seconds on local disk.

### Write-path hooks

Every place that changes `.md` content or metadata calls a matching SearchIndex method:

| Project-service operation | SearchIndex call |
|---|---|
| `createFile(name, tags)` | `indexFile(id, name, tags, '')` |
| `writeFile(filename, content)` | `indexFile(id, name, tags, content)` |
| `deleteFile(fileId)` | `removeFile(id)` |
| `renameFile(fileId, newName)` | `indexFile(id, newName, tags, content)` |
| `saveIndex(index)` (tag changes) | `reindexTagsOnly()` — updates `tags` column for all files from current index |

### Graceful degradation

`better-sqlite3` is a native module. On platforms or installations where it fails to load (Electron version mismatch, missing build tools at install time, unusual architectures), we fall back to the existing linear `search()` with a warning in the Log panel. The FTS code path is gated behind `if (this.fts)` checks; initialization failure sets `this.fts = null` and nothing else breaks.

## Implementation Steps

### Step 1: Add dependency and rebuild native module

```
npm install better-sqlite3
npx electron-rebuild -f -w better-sqlite3
```

Add a `postinstall` script to run `electron-rebuild` so fresh clones work.

### Step 2: SearchIndexService

**New file:** `src/main/search-index-service.js`

```js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;
const DB_DIR = '.noteliner';
const DB_FILE = 'search.db';

class SearchIndexService {
  constructor() {
    this.db = null;
    this.projectPath = null;
  }

  dbPath() { return path.join(this.projectPath, DB_DIR, DB_FILE); }

  async open(projectPath, projectIndex) {
    this.projectPath = projectPath;
    try {
      fs.mkdirSync(path.join(projectPath, DB_DIR), { recursive: true });
      this.db = new Database(this.dbPath());
      this.db.pragma('journal_mode = WAL');
      this.ensureSchema();
      await this.maybeRebuild(projectIndex);
    } catch (err) {
      console.error('[search] FTS init failed, falling back to linear search', err);
      this.db = null;
    }
  }

  close() {
    if (this.db) { this.db.close(); this.db = null; }
  }

  ensureSchema() {
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS notes USING fts5(
        file_id UNINDEXED, name, tags, content,
        tokenize='porter unicode61 remove_diacritics 1'
      );
      CREATE TABLE IF NOT EXISTS index_meta (key TEXT PRIMARY KEY, value TEXT);
    `);
  }

  async maybeRebuild(projectIndex) {
    const version = this.readMeta('schema_version');
    const indexedCount = this.db.prepare('SELECT COUNT(*) AS c FROM notes').get().c;
    if (version !== String(SCHEMA_VERSION) || indexedCount !== projectIndex.files.length) {
      await this.fullRebuild(projectIndex);
    }
  }

  async fullRebuild(projectIndex) {
    this.db.exec('DELETE FROM notes');
    const insert = this.db.prepare('INSERT INTO notes (file_id, name, tags, content) VALUES (?, ?, ?, ?)');
    const tx = this.db.transaction((files) => {
      for (const file of files) {
        const filePath = path.join(this.projectPath, file.filename);
        const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
        insert.run(file.id, file.name, (file.tags || []).join(' '), content);
      }
    });
    tx(projectIndex.files);
    this.writeMeta('schema_version', String(SCHEMA_VERSION));
    this.writeMeta('last_full_rebuild_at', new Date().toISOString());
  }

  indexFile(file, content) {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO notes (file_id, name, tags, content) VALUES (?, ?, ?, ?)
      ON CONFLICT(file_id) DO UPDATE SET name=excluded.name, tags=excluded.tags, content=excluded.content
    `).run(file.id, file.name, (file.tags || []).join(' '), content);
    // Note: FTS5 doesn't support ON CONFLICT directly — actual implementation does DELETE + INSERT in a transaction
  }

  removeFile(fileId) {
    if (!this.db) return;
    this.db.prepare('DELETE FROM notes WHERE file_id = ?').run(fileId);
  }

  search(query, projectIndex) {
    if (!this.db) return null;   // caller falls back to linear
    const ftsQuery = this.translateQuery(query);
    try {
      const rows = this.db.prepare(`
        SELECT file_id,
               snippet(notes, 3, '<mark>', '</mark>', '…', 20) AS snippet,
               bm25(notes, 10.0, 5.0, 3.0, 1.0) AS rank
        FROM notes WHERE notes MATCH ? ORDER BY rank LIMIT 200
      `).all(ftsQuery);
      return rows.map(r => {
        const file = projectIndex.files.find(f => f.id === r.file_id);
        return { fileId: r.file_id, fileName: file?.name, filename: file?.filename, snippet: r.snippet, rank: r.rank };
      });
    } catch (err) {
      return null;  // malformed query; caller can fall back
    }
  }

  translateQuery(raw) {
    // Convert "tag:foo" -> "tags:foo", leave the rest alone
    return raw.replace(/\btag:/gi, 'tags:');
  }

  readMeta(key) { return this.db.prepare('SELECT value FROM index_meta WHERE key = ?').get(key)?.value; }
  writeMeta(key, value) {
    this.db.prepare('INSERT OR REPLACE INTO index_meta (key, value) VALUES (?, ?)').run(key, value);
  }
}

module.exports = { SearchIndexService };
```

### Step 3: Wire into ProjectService

**`src/main/project-service.js`:**

Inject `SearchIndexService` in the constructor. Call:
- `searchIndex.open(folderPath, this.index)` after loading `noteliner.json` in `openProject` and `initProject`.
- `searchIndex.indexFile(entry, content)` at the end of `writeFile`.
- `searchIndex.indexFile(entry, initialContent)` at the end of `createFile`.
- `searchIndex.removeFile(fileId)` at the end of `deleteFile`.
- `searchIndex.indexFile(updatedEntry, content)` at the end of `renameFile`.
- Replace the body of `search(query, options)` with:
  ```js
  const ftsResults = this.searchIndex.search(query, this.index);
  if (ftsResults) return ftsResults;
  return this.linearSearch(query, options);  // existing code renamed
  ```

### Step 4: Update SearchPane.svelte

**`src/renderer/components/SearchPane.svelte`:**

- Result object shape changes from `{ fileId, fileName, matches: [{ line, text }] }` to `{ fileId, fileName, snippet, rank }`.
- Render one row per file (not per match). The `snippet` column contains `<mark>...</mark>` tags — use `{@html snippet}` (safe because we control the renderer).
- Drop the "line N:" prefix. Keep filename header, show snippet below.
- Style `.search-snippet mark { background: var(--bg-selected); color: var(--accent); }`.

If users complain about missing line numbers, add a `lineInfo` post-processing step in Step 5 below.

### Step 5: Gitignore

Ensure `.noteliner/` is in the project's `.gitignore`. Check in `openProject` after determining `isGit && hasIndex`; if missing, append. Only do this on project open, never silently modify otherwise.

### Step 6: Settings surface

Optional: expose an "FTS: Rebuild search index" button in `SettingsModal.svelte` that calls a new IPC handler `search:rebuild`. Useful if the user suspects drift.

## Edge Cases

- **Empty content files**: FTS5 handles empty strings fine; they just never match.
- **Huge notes (>1MB)**: FTS5 indexes them but memory spikes during rebuild. Consider chunking only if users report issues — most markdown notes are <100KB.
- **External edits** (user edits `.md` in another editor while Noteliner is closed): on next open, our drift detection compares `fileCount` but not content. A stronger heuristic would hash the files on open; for V1, the "FTS: Rebuild" setting is the escape hatch.
- **Project on network drive**: `better-sqlite3` requires POSIX locking. WAL mode helps but may degrade on SMB shares. Document the limitation; suggest local project copies.
- **Deleted files reappearing via git pull**: after `gitService.pull`, the file reappears on disk but the FTS index doesn't know. Either (a) trigger a re-index on every pull, or (b) rely on the drift check at next open. Pick (a) if pulls are frequent; hook into `gitService.pull` completion.

## Testing

1. Fresh project, no DB — open, verify rebuild happens, verify query returns results.
2. Measure query latency on a 1000-note project. Target: <20ms for typical queries.
3. Delete the `.noteliner/` folder — verify auto-rebuild on next open.
4. Type `tag:research` — verify only notes with that tag match.
5. Type `"exact phrase"` — verify phrase match works.
6. Rename a note — verify it's searchable under the new name immediately.
7. Edit a note, save, re-query — verify new content matches.
8. On a platform where `better-sqlite3` fails — verify graceful fallback to linear search with a log entry.

## Rollout and Migration

No migration needed — the DB builds itself on first open after the upgrade. The existing linear-search code path is retained as a fallback, not removed. If a user opens a project on a machine where the native module is broken, they see the (slower) old behavior and a warning, not a crash.

Version bump `noteliner.json` to `version: 3` if we want a clean upgrade marker, but it's not required — the DB has its own `schema_version` meta row.

## Out of Scope (V1)

- Fuzzy matching (typo tolerance) — FTS5's trigram tokenizer could be added as a follow-up.
- Multi-project / global search — requires a different DB layout.
- Live re-ranking or semantic search — out of scope for an offline-first app.

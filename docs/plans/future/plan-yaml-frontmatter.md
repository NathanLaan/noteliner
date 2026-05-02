# YAML Frontmatter Support — Implementation Plan

## Overview

Adopt YAML frontmatter at the top of each `.md` file as a portable,
in-band metadata format. NoteLiner continues to keep its authoritative
metadata in `noteliner.json`, but it also writes a frontmatter block on
disk so that other tools — Obsidian, Tolaria, static-site generators,
`grep`, the user's editor — can read NoteLiner notes without parsing the
sidecar index.

This is **about interoperability**, not about migrating off `noteliner.json`.
The index keeps owning hierarchy and ordering (concepts that don't map
cleanly into per-file metadata).

## Goals

1. Round-trip notes between NoteLiner and other markdown tools without
   metadata loss.
2. Make `.md` files self-describing enough that `cat note.md` shows the
   reader what tags and identity it has.
3. No regressions: a project opened in NoteLiner today must still open
   and behave identically after upgrade.
4. Authoritative source of truth for hierarchy/order remains
   `noteliner.json`. Frontmatter is a **mirror** for portable fields, not
   a fork.

## Current State

- **Metadata lives only in `noteliner.json`** as
  `{ id, name, filename, parentId, order, tags, attachments }`
  (`project-service.js:127-145`).
- **`.md` files are pure markdown.** No frontmatter parsing or emission
  anywhere in the codebase.
- **Editor (`Editor.svelte`)** loads file content via `readFile` and writes
  back via `writeFile`. Both pass content through unchanged.
- **Preview (`Preview.svelte:49`)** runs `marked(content)` over the whole
  body — frontmatter would render as visible text today.
- **Export pipeline** (`main.js:427`/`main.js:466` — `convertToHtml`,
  `convertToPdf`) also feeds the whole body through `marked`.

## Design

### Frontmatter shape

```yaml
---
id: 7e9c... # UUID, mirrors noteliner.json
name: Q3 Planning
tags: [strategy, hr]
created: 2026-03-12T14:08:00Z
updated: 2026-04-29T09:31:00Z
---

# Q3 Planning

…body…
```

Fields written by NoteLiner:

| Field | Source of truth | Purpose |
|---|---|---|
| `id` | `noteliner.json` | Stable identity; survives renames |
| `name` | `noteliner.json` | Human-readable title (mirrored) |
| `tags` | `noteliner.json` | Round-trippable to other tools |
| `created` | New: per-file mtime at first write | Useful for chronological tooling |
| `updated` | Refreshed on every write | Useful for chronological tooling |

`parentId`, `order`, and `attachments` are **deliberately not** in
frontmatter — those are project-level structure, not note-intrinsic.
Putting `parentId` per-file would create two-way sync hell (rename a parent,
have to rewrite N children).

### Source-of-truth rule

**On read** (open project): `noteliner.json` wins. Frontmatter is treated as
informational. If frontmatter `tags` differs from index `tags`, the index
wins; we log a warning to the Log panel and queue a one-shot mirror-rewrite
to bring frontmatter back in sync.

**On write** (any change to a note): write the body, then ensure
frontmatter mirrors index state for that file. This is a separate write,
folded into the same auto-commit.

**On external edit** (user changed a `.md` in another editor and pulled via
git): when NoteLiner detects the file's git hash changed but the index
wasn't updated, re-scan frontmatter and *propose* changes to apply to the
index — never silent. (See "Conflict resolution" below.)

### Why not let frontmatter own things?

Frontmatter-as-source-of-truth would mean: a rename rewrites every
referencing file's frontmatter, ordering becomes "whatever order the files
sort in," and `noteliner.json` becomes a cache instead of a model. That is
a much bigger redesign than what this plan tackles. We may revisit later;
for now, keep `noteliner.json` authoritative and frontmatter as a mirror.

### Library choice

Use a lightweight YAML + frontmatter splitter:

- `gray-matter` is the conventional choice (~30KB) and round-trips well.
- Or write ~40 lines: detect leading `---\n…\n---\n`, parse YAML with
  `js-yaml`, return `{ data, content }`.

`gray-matter` is fine; it pulls in `js-yaml` anyway. Pick it.

## Implementation Steps

### Step 1: Add dependency

```bash
npm install gray-matter
```

### Step 2: Frontmatter helper

**New file:** `src/main/frontmatter-service.js`

```js
const matter = require('gray-matter');

const MIRROR_FIELDS = ['id', 'name', 'tags', 'created', 'updated'];

class FrontmatterService {
  parse(raw) {
    try {
      const { data, content } = matter(raw);
      return { data: data || {}, body: content };
    } catch {
      return { data: {}, body: raw };  // malformed → treat whole thing as body
    }
  }

  serialize(body, data) {
    const ordered = {};
    for (const k of MIRROR_FIELDS) if (data[k] !== undefined) ordered[k] = data[k];
    for (const k of Object.keys(data)) if (!MIRROR_FIELDS.includes(k)) ordered[k] = data[k];
    return matter.stringify(body, ordered);
  }

  mirrorFromIndexEntry(entry, existingData = {}) {
    return {
      ...existingData,
      id: entry.id,
      name: entry.name,
      tags: entry.tags || [],
      created: existingData.created || new Date().toISOString(),
      updated: new Date().toISOString(),
    };
  }
}

module.exports = { FrontmatterService };
```

`MIRROR_FIELDS` is the closed set NoteLiner manages. **User-added fields are
preserved untouched** — if someone adds `weight: 5` in another editor,
NoteLiner reads, ignores, and rewrites it on save. That's the
interop bargain.

### Step 3: Wire into ProjectService

**`src/main/project-service.js`:**

`readFile` strips frontmatter before returning to the renderer:

```js
async readFile(filename) {
  const filePath = path.join(this.projectPath, filename);
  if (!fs.existsSync(filePath)) return '';
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { body } = this.frontmatter.parse(raw);
  return body;
}
```

`writeFile` re-attaches frontmatter:

```js
async writeFile(filename, body) {
  const filePath = path.join(this.projectPath, filename);
  const raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  const { data: existing } = this.frontmatter.parse(raw);
  const entry = this.index.files.find(f => f.filename === filename);
  const data = entry
    ? this.frontmatter.mirrorFromIndexEntry(entry, existing)
    : existing;
  const next = this.frontmatter.serialize(body, data);
  fs.writeFileSync(filePath, next, 'utf-8');
  await this.gitService.commit(this.projectPath, `Update ${filename}`);
  this.gitService.schedulePush(this.projectPath);
}
```

`createFile` writes initial frontmatter:

```js
const data = this.frontmatter.mirrorFromIndexEntry(entry);
const initialBody = options.body ?? `# ${name} ${dateStr}\n`;
fs.writeFileSync(filePath, this.frontmatter.serialize(initialBody, data), 'utf-8');
```

`renameFile` and `setTags` call `rewriteFrontmatter(entry)` so the on-disk
mirror catches up immediately.

### Step 4: Hide frontmatter from renderer

The renderer already calls `readFile` and gets the body — no change needed.
But the renderer sees content **without** frontmatter, so:

- Editor: shows pure body. Good.
- Preview: marked sees pure body. Good.
- Word count, search index, link graph: all fed the body, not the raw file.

This is intentional. Frontmatter is metadata, not content.

### Step 5: Reconciliation on project open

In `openProject` after `JSON.parse(fs.readFileSync(...))`:

```js
await this.reconcileFrontmatter();
```

`reconcileFrontmatter` walks every entry, reads the file, compares
frontmatter to index. For each mismatch:

- `id` mismatch in file → log warning; index wins; queue rewrite.
- `tags` mismatch → log warning; index wins; queue rewrite.
- File missing → already a known case, don't worsen it.
- Frontmatter present for a file *not* in index → this is the "user added
  a `.md` outside NoteLiner" case. **Adopt the file**: insert into index
  using frontmatter `id` (or generate a new one), `name`, `tags`. Surface
  as a one-line log: "Adopted note: {name}".

Reconciliation is a single batched commit ("Reconcile frontmatter"), not
N commits.

### Step 6: External-edit detection

NoteLiner already runs `git pull` on project open. Files changed by `pull`
get re-read on next open of that note in the editor. The reconciler in
Step 5 catches index-vs-disk drift on every open.

A more aggressive watcher (chokidar on the project root) is **out of scope
for v1** — the open-time reconciler is sufficient for the common case
(user pulls, then opens NoteLiner).

### Step 7: Settings toggle (optional)

Add to Settings → "Storage" section: **Write frontmatter to .md files**
(default: on). When off, NoteLiner stops emitting frontmatter on writes
*but still reads it* if present (because other tools may have added it).
Lets users who deeply dislike frontmatter opt out without losing interop
when they choose to enable it.

## Migration Strategy

For an existing project (no frontmatter today) opened with the new build:

1. Reconciler runs, sees zero frontmatter on every file, logs:
   "Adding frontmatter to N files. This is a one-time migration."
2. Each file is rewritten with its mirrored frontmatter.
3. **All files in one git commit:** "Add YAML frontmatter to all notes."
4. From that point on, writes are incremental.

Why one commit instead of per-file? Because per-file would generate N
commits for a no-op-from-the-user's-perspective change, polluting history.

A user who wants to skip migration can disable the setting before opening
the project. (Edge case; not worth over-engineering.)

## Edge Cases

- **A note's body starts with `---`** (e.g., a horizontal rule at the very
  top): `gray-matter` distinguishes by the *closing* `---` and successful
  YAML parse. If parse fails, we treat the whole file as body. Verify with
  a test: file `---\n# H1\n---\nbody\n` should not eat the `# H1`.
- **Empty file:** Skip frontmatter on first write of an empty body. Or
  always write it. We always write it — consistency wins.
- **Binary attachments:** Frontmatter logic only fires for `.md` files.
  Attachments in `_attachments/` are untouched.
- **Manually edited frontmatter:** If the user edits frontmatter in their
  external editor (changes `tags: [foo]` to `tags: [bar]`), NoteLiner
  detects on next open via the reconciler and either logs the difference
  or, if the index is older, *adopts* the new values. v1 always favors
  the index — see Open Question 1.
- **Renaming via `mv` outside NoteLiner:** Filename changes, frontmatter
  `id` survives, the reconciler can re-bind by `id` and update the index
  to point at the new filename. Nice property.
- **Concurrent NoteLiner instances on the same project (rare):** Each
  writes frontmatter on its own writes. As long as they're not editing the
  same file simultaneously (existing risk), no new failure mode.

## Conflict Resolution (Open Question 1)

When external frontmatter and `noteliner.json` disagree, who wins?

- **v1 chosen behavior:** index wins. Log a warning. This is the safest
  default — the index has been the source of truth for years; quietly
  adopting external changes risks data loss if the external edit was an
  error.
- **v2 candidate:** "newer wins" via `updated` timestamp. Requires trust
  in clock skew across devices.
- **v3 candidate:** Surface conflicts in the Log panel with an "Apply"
  button per conflict.

## Testing

1. Create a new note → file on disk has frontmatter; reading it back yields
   body without frontmatter; editor shows body only.
2. Rename a note → frontmatter `name` updates; `id` and `created` unchanged.
3. Add a tag → frontmatter `tags` updates.
4. Manually edit frontmatter outside NoteLiner (change `tags`), reopen
   project → log warning; index `tags` retained; frontmatter rewritten.
5. Drop a hand-written `.md` with frontmatter into the project folder
   outside NoteLiner, reopen → file appears in FILES pane (adopted), name
   matches frontmatter.
6. Open a project that has `gray-matter`-incompatible content (e.g.,
   genuinely just `---` lines in the body) → no crash, content preserved.
7. Migrate an existing project: single commit, all files now have
   frontmatter, `noteliner.json` unchanged.
8. Round-trip: edit a NoteLiner note in Obsidian, save with new tag in
   frontmatter → open in NoteLiner → log shows divergence (per v1 policy
   index wins, but evidence is visible).

## Out of Scope (V1)

- **Custom field mapping** (e.g., let users declare `category` mirrors
  to a NoteLiner concept). Frontmatter is read-mirror only for the closed
  set above.
- **YAML aliases / anchors.** Not used in practice.
- **TOML / JSON frontmatter.** YAML is the de facto standard.
- **Real-time filesystem watching.** Open-time reconciler only.
- **Migrating `noteliner.json` away.** Out of scope; it stays.

## Rollout

No schema bump on `noteliner.json` (still v2). One-time migration commit
per existing project on first open. Behavior gated by setting; default on.
The Log panel surfaces the migration so the user knows what happened.

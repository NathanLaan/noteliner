# Remote Pages Deployment

## Overview

Add the ability to publish project content as a static website to GitHub Pages or GitLab Pages. Converts all markdown files to HTML, generates an index page, copies attachments, and deploys via git to the appropriate branch or directory.

## Feasibility

**Yes, this is fully feasible.** Everything needed is already in the codebase or available as a dependency:

- **`marked` v15.0.0** is already in `package.json` — pure JS, works on the main process without any browser APIs. The renderer already uses it in `Preview.svelte`.
- **Git operations** — `git-service.js` has `exec()` which can run any git command. Branch creation/switching is straightforward to add.
- **Project index** — `noteliner.json` has all the metadata needed: file names, display names, ordering, hierarchy, and attachment references.
- **Attachment references** — Markdown files use `./_attachments/att-{id}.{ext}` relative paths, which work directly as relative URLs in static HTML. No rewriting needed.

## Platform Requirements

### GitHub Pages

- Deploy static HTML to a `gh-pages` orphan branch.
- GitHub auto-serves the branch once the user enables Pages in repo settings (Settings > Pages > Source: `gh-pages`).
- No configuration files needed in the branch.
- Workflow: create orphan branch → write HTML + attachments → commit → force push → switch back to original branch.

### GitLab Pages

- Deploy static HTML to a `public/` directory on the main branch, with a `.gitlab-ci.yml` that exposes it.
- GitLab auto-deploys when CI detects the `pages` job.
- Workflow: generate HTML into a `_pages/` staging directory → write `.gitlab-ci.yml` → commit → push.
- Alternative: use the same `gh-pages` branch approach. GitLab also supports deploying from a branch. However, the CI approach is more idiomatic for GitLab.

### Recommended Approach

Use **`gh-pages` branch** for both platforms. It's simpler (no CI config needed for GitHub, and GitLab can be configured to deploy from a branch too), keeps deployment artifacts out of the main branch, and the implementation is identical for both hosts.

## Design

### HTML Generation

Each markdown file produces a standalone HTML page with:
- A `<!DOCTYPE html>` wrapper with meta tags, title, and embedded CSS
- Navigation back to the index
- The rendered markdown body (via `marked()`)
- Relative attachment paths preserved (`./_attachments/...`)

The **index page** (`index.html`) lists all project files in order, grouped by tags if tags exist, with links to each page's HTML file.

### Deployment Flow (gh-pages branch)

```
1. Save current branch name
2. Stash any uncommitted changes (safety)
3. Check if gh-pages branch exists locally
   - If yes: checkout gh-pages
   - If no: create orphan branch (git checkout --orphan gh-pages)
4. Remove all tracked files (git rm -rf .)
5. Generate HTML files:
   - Read noteliner.json for file list and metadata
   - For each file: read .md, convert via marked(), write .html
   - Generate index.html from file list
   - Copy _attachments/ directory
6. git add -A
7. git commit -m "Deploy to Pages"
8. git push -f origin gh-pages
9. Checkout original branch
10. Pop stash if we stashed in step 2
```

Force push (`-f`) is used because the gh-pages branch is fully regenerated each time — there's no meaningful history to preserve.

### HTML Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{pageTitle}</title>
  <style>{embeddedCSS}</style>
</head>
<body>
  <nav><a href="index.html">← Index</a></nav>
  <article>
    <h1>{pageTitle}</h1>
    {htmlBody}
  </article>
</body>
</html>
```

CSS is embedded (no external stylesheet to manage). A clean, readable style — light background, constrained content width, basic typography.

### Index Page

```html
<h1>{projectName}</h1>
<ul>
  <li><a href="document-001.html">Document 001</a></li>
  <li><a href="noteliner-ai.html">NoteLiner AI</a></li>
  ...
</ul>
```

Files listed in `order` field sequence from `noteliner.json`. If tags exist, optionally group by tag with tag headings.

## Implementation Steps

### Step 1: Git service — Branch operations

**File:** `src/main/git-service.js`

Add methods:

```js
async branchExists(folderPath, branchName) {
  // git branch --list branchName
}

async switchBranch(folderPath, branchName) {
  // git checkout branchName
}

async createOrphanBranch(folderPath, branchName) {
  // git checkout --orphan branchName
}

async removeAllTracked(folderPath) {
  // git rm -rf .
}

async stash(folderPath) {
  // git stash
}

async stashPop(folderPath) {
  // git stash pop
}

async forcePush(folderPath, branchName) {
  // git push -f origin branchName
}
```

### Step 2: Pages service

**New file:** `src/main/pages-service.js`

```js
class PagesService {
  constructor(gitService, projectService) { ... }

  async deploy(folderPath) {
    // Orchestrates the full deployment:
    // 1. Read noteliner.json
    // 2. Save current branch, stash changes
    // 3. Switch to gh-pages (create orphan if needed)
    // 4. Clean branch
    // 5. Generate HTML files
    // 6. Copy attachments
    // 7. Commit and force push
    // 8. Switch back, pop stash
  }

  generatePageHtml(title, markdownContent, projectName) {
    // Returns full HTML string for one page
  }

  generateIndexHtml(projectName, files) {
    // Returns full HTML string for the index page
  }

  getEmbeddedCss() {
    // Returns CSS string for pages styling
  }
}
```

The `deploy()` method is the main entry point. It uses `try/finally` to ensure the original branch is restored even if an error occurs mid-deploy.

### Step 3: IPC handlers and preload

**File:** `src/main/main.js`

```js
ipcMain.handle('pages:deploy', async () => {
  return await pagesService.deploy(projectService.projectPath);
});

ipcMain.handle('pages:getStatus', async () => {
  // Check if gh-pages branch exists and when it was last deployed
});
```

**File:** `src/main/preload.js`

```js
deployPages: () => ipcRenderer.invoke('pages:deploy'),
getPagesStatus: () => ipcRenderer.invoke('pages:getStatus'),
```

### Step 4: Deploy UI in SyncModal

**File:** `src/renderer/components/SyncModal.svelte`

Add a "Pages" section to the existing SyncModal (below the Push/Pull buttons):

```
┌──────────────────────────────────────────────┐
│ REMOTE SYNC                                  │
├──────────────────────────────────────────────┤
│ Remote URL: https://github.com/user/repo     │
│ Branch: main                                 │
│ Status: Synced                               │
│ [Pull]  [Push]                               │
│                                              │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                              │
│ PAGES                                        │
│ Publish your notes as a website via          │
│ GitHub/GitLab Pages.                         │
│                                              │
│ ⚠ If your repository is public, the          │
│ published site will be publicly accessible.  │
│                                              │
│ [Deploy to Pages]                            │
│                                              │
│ Last deployed: 2026-04-12 10:30              │
└──────────────────────────────────────────────┘
```

- **Visibility warning** — A persistent warning message displayed in the Pages section: "If your repository is public, the published site will be publicly accessible on the internet." Styled with the existing `info-msg` pattern (left accent border, muted background). Always visible — not a one-time confirmation — so the user sees it every time they open the modal.
- **Deploy button** — Calls `window.api.deployPages()`. Disabled if no remote is configured. Shows spinner while deploying.
- **Status** — Shows last deploy timestamp (read from the gh-pages branch's latest commit date).
- **Progress** — Deploy progress appears in the Log Panel via the existing `git:log` event stream.

### Step 5: Attachment handling

During deploy, copy the `_attachments/` directory from the project folder into the gh-pages branch root. The HTML references already use `./_attachments/filename` paths, which resolve correctly as relative URLs in the deployed site.

```js
// In pages-service.js deploy():
const attachmentsDir = path.join(folderPath, '_attachments');
if (fs.existsSync(attachmentsDir)) {
  fs.cpSync(attachmentsDir, path.join(folderPath, '_attachments'), { recursive: true });
  // (attachments are already in-place since we're in the same folder, just need to stage them)
}
```

Since `git rm -rf .` removes all tracked files but `_attachments/` is untracked on the orphan branch, we need to explicitly copy it from a saved location (or stash it before the branch switch). The deploy method handles this by reading the attachment files into memory before switching branches, then writing them back.

## File Change Summary

| File | Change |
|---|---|
| `src/main/git-service.js` | Add `branchExists`, `switchBranch`, `createOrphanBranch`, `removeAllTracked`, `stash`, `stashPop`, `forcePush` |
| `src/main/pages-service.js` | **New file** — HTML generation, index generation, deploy orchestration |
| `src/main/main.js` | Initialize PagesService, add 2 IPC handlers |
| `src/main/preload.js` | Add `deployPages`, `getPagesStatus` API methods |
| `src/renderer/components/SyncModal.svelte` | Add Pages section with deploy button and status |

## Design Decisions

1. **`gh-pages` orphan branch for both GitHub and GitLab.** Keeps deployment artifacts completely separate from source content. No CI configuration files polluting the main branch. GitLab can be configured to serve from a branch just like GitHub.

2. **Force push on every deploy.** The gh-pages branch is fully regenerated from scratch each time. There's no value in preserving deployment history — the source history is in the main branch. Force push keeps the gh-pages branch clean (no ballooning history).

3. **Embedded CSS, no external dependencies.** Each HTML page is fully self-contained. No CDN links, no external stylesheets, no JavaScript. Pages load instantly and work offline if saved. One CSS string is shared across all generated pages.

4. **Deploy from SyncModal, not a separate UI.** Pages deployment is closely related to remote sync — it requires a configured remote and uses git push. Adding it to the existing SyncModal keeps the UI cohesive and avoids a separate modal.

5. **Read files into memory before branch switch.** When switching to the orphan gh-pages branch, the working directory changes. The deploy method reads all markdown files and attachment binaries into memory first, then writes them as HTML after the branch switch. This avoids filesystem state issues.

6. **Attachments copied as-is.** No image optimization, no re-encoding. The `_attachments/` directory structure and filenames are preserved exactly, so relative paths in the generated HTML work without modification.

7. **Persistent visibility warning.** The Pages section in SyncModal always shows a warning about public visibility. On public repos, GitHub and GitLab Pages sites are publicly accessible to anyone with the URL. On private repos: GitHub requires a paid plan for Pages; GitLab restricts access to project members by default. Since the app cannot reliably detect repo visibility (it would require an authenticated API call), the warning is always shown.

## User Workflow

1. Write notes in NoteLiner.
2. Configure remote via Sync modal (if not already done).
3. Click "Deploy to Pages" in the Sync modal.
4. NoteLiner generates HTML, commits to `gh-pages`, and pushes.
5. User enables GitHub/GitLab Pages in their repo settings (first time only).
6. Site is live at `https://username.github.io/repo-name/` or equivalent.

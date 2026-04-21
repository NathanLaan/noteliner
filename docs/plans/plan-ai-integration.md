# AI Integration — Implementation Plan

## Overview

Integrate a console-based AI assistant into NoteLiner so that generated content
(implementation plans, design notes, summaries, research) can be saved directly
into the current project. Because every project is already a git repository
with auto-commit on file change, any file the AI writes is automatically
versioned without additional plumbing.

The integration is a **modular feature** — a togglable "AI" panel/module that
can be enabled per-project (or globally) and disabled entirely for users who
don't want it.

## Goals

1. Let the user invoke an AI from within NoteLiner and have the response saved
   as a markdown file in the current project (default: `docs/plans/` or a
   user-configurable subfolder).
2. Leverage NoteLiner's existing auto-commit so every AI-generated file is
   versioned in git.
3. Ship as an opt-in module (feature flag + UI panel) so non-AI users see no
   behavior change.
4. Keep API keys and provider config out of the project repo (personal, not
   collaborative — same reasoning as window state).

## Current State

- **No AI code exists.** No dependencies on Anthropic, OpenAI, or any AI SDK.
- **Files in the project root auto-commit on save** (`src/main/git-service.js`
  is invoked from `file:writeFile` in `main.js`). Any new `.md` file dropped
  into the project directory and tracked by `noteliner.json` gets committed.
- **Project index (`noteliner.json`) governs which files are visible** in the
  FILES pane. Files on disk but not in the index are ignored by the UI.
- **Personal settings already live outside the project** in
  `{userData}/ui-preferences.json` and `{userData}/window-state.json`. AI
  config (provider, API key, model) should follow the same pattern.

## Integration Options

Five realistic options. They are not mutually exclusive — (A) and (C) could
ship together, for example — but the plan recommends starting with **Option A**
for the first cut.

### Option A — Subprocess to an external CLI (recommended first cut)

NoteLiner spawns an existing CLI tool (`claude`, `aider`, `llm`,
`ollama run`, etc.) as a child process from the Electron main process. Stdin
receives the prompt; stdout is streamed back to the renderer and also written
to a file in the project.

**Pros**
- No direct API key handling inside NoteLiner — the CLI owns auth.
- Works with any CLI the user already has configured.
- User keeps their existing AI setup, context files, MCP servers, skills, etc.
- Smallest code surface: one `child_process.spawn` + a streaming IPC channel.

**Cons**
- Requires the user to install a CLI separately.
- Cross-platform differences (shell resolution, PATH, `.nvm`/`.asdf` wrappers).
- No structured output — we parse stdout as-is.

**Sketch**
```js
// main.js
ipcMain.handle('ai:run', async (_e, prompt, opts) => {
  const proc = spawn(opts.command, opts.args, {
    cwd: projectService.projectPath,
    env: process.env
  });
  proc.stdin.write(prompt);
  proc.stdin.end();
  // stream stdout chunks back via webContents.send('ai:chunk', ...)
  // on close: write final buffer to docs/plans/<slug>.md, add to index
});
```

### Option B — Direct API integration via Anthropic SDK

NoteLiner ships the `@anthropic-ai/sdk` (or provider-agnostic equivalent) and
talks to the model directly from the main process. API key is stored in
`{userData}/ai-config.json` (chmod 600 on Unix).

**Pros**
- No external CLI dependency — works out of the box.
- Full control over prompts, tool use, caching, streaming UI.
- Can wire NoteLiner-specific tools (read-file, write-file, list-files)
  directly into the model's tool-use loop.

**Cons**
- Secret management: API keys on disk. Must not leak into git (the project
  directory is git-tracked; this file must live in `userData`, never in the
  project).
- Locks us to a provider SDK (or we ship multiple).
- We reimplement what Claude Code / aider already do well (context gathering,
  file editing, prompt caching). High cost, low differentiation.
- Adds ~5MB+ of SDK dependencies to the Electron bundle.

**When this is worth it:** when we want NoteLiner-specific tool use that a
generic CLI can't provide — e.g. the model creating tag groups, reordering
the outline, or editing `noteliner.json` directly.

### Option C — Embedded terminal panel (xterm.js + node-pty)

Add a terminal pane (like VS Code's integrated terminal) running the user's
shell inside the project directory. The user runs whatever AI CLI they want;
NoteLiner offers a "Save last output to plan" button that captures the most
recent command's stdout into a markdown file.

**Pros**
- Maximum flexibility — user is not locked to one AI tool.
- Doubles as a general terminal (useful for git ops, running builds, etc.).
- The "capture last output" UX is simple and discoverable.

**Cons**
- `node-pty` is a native dependency — complicates electron-builder packaging
  on Windows/macOS/Linux.
- xterm.js + addons adds ~200KB; pty addon requires rebuild per Electron
  version.
- "Capture last output" requires parsing terminal output (ANSI escape codes,
  prompts) reliably, which is fragile.

### Option D — Filesystem watcher ("drop zone")

No in-app AI UI at all. NoteLiner watches a designated subfolder (e.g.
`_ai-inbox/`) for new files. The user runs their AI elsewhere (external
terminal, Claude Desktop, etc.) and writes output to that folder. NoteLiner
picks it up, moves it to the main tree, adds it to `noteliner.json`, and
commits.

**Pros**
- Zero AI-specific code in NoteLiner — just a chokidar watcher.
- Works with any tool, including ones that don't exist yet.
- Keeps NoteLiner's scope tight.

**Cons**
- Poor UX — the user has to switch between two apps.
- No conversation, no streaming, no in-app prompting.
- Feels like a workaround, not a feature.

### Option E — MCP server exposed by NoteLiner

NoteLiner exposes an [MCP](https://modelcontextprotocol.io) server over stdio
or a local socket. The user runs Claude Code (or another MCP-capable client)
externally, which can list files, read the project index, and write back into
the project via NoteLiner's tools.

**Pros**
- Clean separation of concerns — AI lives outside, NoteLiner is a data source.
- Works with any MCP-compatible client, now and in the future.
- NoteLiner exposes first-class tools (`list_notes`, `read_note`, `create_note`,
  `set_tags`) that operate on `noteliner.json` correctly, not just raw files.

**Cons**
- Requires the user to configure their MCP client — non-trivial setup.
- No in-app UI — the user still runs the AI elsewhere (addresses a different
  use case than the user's request).
- MCP is still a moving target; client support varies.

**When this is worth it:** as a complement to (A) or (B), once the basic
integration exists. It's the "serious users" escape hatch.

## Recommendation

**Ship Option A first.** It is the smallest, safest change that delivers the
requested feature (AI-generated plans → auto-committed in the project).
Specifically:

- **Default command:** `claude` (Claude Code CLI), because it already handles
  context, tool use, and prompt caching better than we would reimplement.
- **Configurable** via AI Settings modal: command path, extra args, output
  folder (default `docs/plans/`), file naming template.
- **Toggle** via `layout.showAI` following the existing panel pattern.
- Revisit Option B or E only after usage reveals concrete limits of (A).

## UI Design

### Toolbar button

New toolbar button (fa-wand-magic-sparkles or fa-robot), title "AI (Ctrl+Shift+A)".
Active-state styling when `layout.showAI` is true. Hidden entirely when the AI
module is disabled in global settings (see "Module Toggle" below).

### AI panel

New side panel (right side, like Preview). Contents:

```
+------------------------------------------+
| AI                               [x]    |
+------------------------------------------+
| Prompt:                                  |
| [____________________________________]   |
| [____________________________________]   |
| [____________________________________]   |
|                                          |
| Output folder: docs/plans/   [Browse]    |
| Filename: plan-{slug}.md                 |
|                                          |
|                    [Cancel]  [Run]       |
+------------------------------------------+
| Output (streaming):                      |
| ...                                      |
+------------------------------------------+
```

Running sets a "busy" state; Cancel sends SIGTERM to the subprocess. When the
run completes, the output is written to `{output-folder}/{filename}.md`, added
to `noteliner.json`, and the file appears in the FILES pane (triggering the
standard auto-commit).

### Settings

New section in the Settings modal ("AI"):

- **Enable AI module** — master on/off. When off, toolbar button is hidden and
  no subprocess can be spawned.
- **Command** — path or name (default: `claude`).
- **Extra args** — space-separated args passed before the prompt.
- **Default output folder** — default `docs/plans/`.
- **Filename template** — default `plan-{slug}.md` (tokens: `{slug}`, `{date}`,
  `{time}`).

Stored in `{userData}/ai-config.json` (global, not per-project — API keys and
tool paths are machine-local).

## Data & IPC

### New IPC handlers

| Channel | Direction | Purpose |
|---|---|---|
| `ai:getConfig` | renderer → main | Read `ai-config.json`. |
| `ai:setConfig` | renderer → main | Write `ai-config.json`. |
| `ai:run` | renderer → main | Spawn subprocess with prompt, return runId. |
| `ai:cancel` | renderer → main | Kill a running subprocess by runId. |
| `ai:chunk` | main → renderer | Streamed stdout chunk for a runId. |
| `ai:done` | main → renderer | Final event: `{ runId, outputPath, error }`. |

### File creation flow

1. User clicks Run.
2. Renderer calls `ai:run` with `{ prompt, outputFolder, filenameTemplate }`.
3. Main process spawns the configured CLI with `cwd = projectService.projectPath`.
4. Stdout chunks stream back via `ai:chunk`.
5. On process close with exit code 0:
   - Resolve filename from template.
   - Ensure output folder exists (create if needed).
   - Write stdout buffer to disk.
   - Call `projectService.addFile()` to register it in `noteliner.json`.
   - Existing auto-commit picks it up.
   - Emit `ai:done` with the output path.
6. On non-zero exit: emit `ai:done` with `error`, do not write the file.

### Output folder behavior

If the configured output folder does not exist, create it. If the file already
exists, append a numeric suffix: `plan-foo.md`, `plan-foo-2.md`, etc. (Same
pattern used by attachment deduplication.)

## Module Toggle

The feature is opt-in at two levels:

1. **Build-time flag** — `VITE_ENABLE_AI=1` at build time. When absent, the
   toolbar button, settings section, and all IPC handlers are stripped. This
   is for distributions that want a "no AI" build.
2. **Runtime toggle** — the "Enable AI module" setting. Default: off. Users
   flip it on, configure the command, and the button appears.

Both guards are necessary: build-time for deployments that can't ship AI at
all (corporate, offline); runtime for users who just want it off today.

## Security Considerations

- **Never log API keys.** If (B) is added later, redact anything matching
  `sk-*` in log output.
- **Prompt content is user data.** Don't forward it to any telemetry endpoint.
- **Subprocess args are not shell-interpolated.** Use `spawn` with an argv
  array, not `exec` with a string. Reject config entries containing shell
  metacharacters.
- **Output folder is constrained to the project root.** Reject `..` segments
  and absolute paths in the folder config.
- **Respect project isolation.** The subprocess's `cwd` is the project
  directory. It must not have ambient access to unrelated files (beyond what
  the CLI itself can read via the user's shell env).

## Open Questions

1. Should the AI panel also support **chat** (multi-turn) or only single-shot
   "generate a plan"? Single-shot is simpler and matches the user's stated
   use case; chat is a natural follow-up.
2. Should generated files be **added to `noteliner.json` automatically**, or
   dropped on disk and left to the existing "unknown file" flow (if any)?
   Auto-add is friendlier but commits to an implementation detail.
3. Should the prompt **include context from the current project** (selected
   file, recent edits)? If yes, that's a point for Option B or E, where we
   control the prompt envelope.
4. Do we want a **templates library** (pre-canned prompts: "write an
   implementation plan for X", "summarize this file", "generate tags")? Not
   needed for v1, but useful scaffolding.

## Phasing

**v1 (this plan):** Option A only. Toolbar button, panel, settings, IPC,
subprocess spawn, file write, auto-commit. Default command `claude`.

**v2:** Streaming output rendered as markdown in the panel (not just a
scrollable log). Cancel button. Re-run with edited prompt.

**v3:** Option B as an alternative provider, behind the same UI. Adds API
key management and a provider dropdown.

**v4:** Option E (MCP server) for power users who want their external AI to
read/write NoteLiner projects natively.

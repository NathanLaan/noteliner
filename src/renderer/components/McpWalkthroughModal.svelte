<script>
  // Consent gate shown every time a user toggles MCP from off to on. The
  // toggle in SettingsModal does not commit until the user clicks Enable
  // here; Cancel leaves MCP disabled. Re-runs on every re-enable so the
  // architecture and config snippet are always in view before exposure.

  let { bridgePath, onEnable, onCancel } = $props();
  let copied = $state(false);

  // The snippet mirrors what Settings → MCP shows once the server is live,
  // so users see the same JSON before and after enabling. Bridge path is
  // resolved by main and shipped via getMcpStatus, so it's always correct
  // for the current install (dev vs packaged).
  let snippet = $derived(bridgePath
    ? JSON.stringify({
        mcpServers: {
          noteliner: {
            command: 'node',
            args: [bridgePath],
          },
        },
      }, null, 2)
    : '');

  async function copySnippet() {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      copied = true;
      setTimeout(() => { copied = false; }, 1500);
    } catch { /* ignore */ }
  }

  function focusOnMount(node) { node.focus(); }

  function handleKeydown(e) {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter') onEnable();
  }
</script>

<div
  class="modal-overlay"
  use:focusOnMount
  onclick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
  onkeydown={handleKeydown}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <div class="modal mcp-walkthrough">
    <div class="modal-header">
      <h2><i class="fas fa-plug"></i> Enable the MCP server</h2>
    </div>

    <div class="modal-body">
      <p class="lede">
        NoteLiner can expose the currently-open project to external AI assistants
        (Claude Code, Claude Desktop, Cursor, ...) so they can list, read, search,
        and write notes. Every write goes through the normal save path and is
        committed to git automatically.
      </p>

      <h3>How it works</h3>
      <div class="diagram">
        <div class="step">
          <span class="step-num">1</span>
          <span class="step-body">NoteLiner listens on a private local socket while a project is open.</span>
        </div>
        <div class="step">
          <span class="step-num">2</span>
          <span class="step-body">Your AI client launches a small <code>noteliner-mcp-bridge</code> helper that pipes its stdio into that socket.</span>
        </div>
        <div class="step">
          <span class="step-num">3</span>
          <span class="step-body">The client calls tools (<code>list_notes</code>, <code>create_note</code>, ...) — you see every operation in the Sync Log.</span>
        </div>
      </div>

      <h3>Add this to your MCP client config</h3>
      <p class="setting-help">
        For Claude Code: <code>.mcp.json</code> in your project. For Claude Desktop:
        <code>claude_desktop_config.json</code>. The bridge path below is the one
        on this machine.
      </p>

      <div class="snippet-wrap">
        <pre class="snippet">{snippet || 'Bridge path unavailable.'}</pre>
        <button class="snippet-copy" onclick={copySnippet} disabled={!snippet}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div class="callouts">
        <div class="callout">
          <i class="fas fa-shield-halved"></i>
          <span>Local-only — no TCP port is opened. The socket file is user-readable only.</span>
        </div>
        <div class="callout">
          <i class="fas fa-circle-check"></i>
          <span>You can require confirmation for every write in Settings → MCP → Safety.</span>
        </div>
        <div class="callout">
          <i class="fas fa-folder-open"></i>
          <span>The server only ever exposes the currently-open project, not your other repos.</span>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="cancel-btn" onclick={onCancel}>Cancel</button>
      <button class="enable-btn" onclick={onEnable}>Enable MCP server</button>
    </div>
  </div>
</div>

<style>
  .mcp-walkthrough {
    max-width: 640px;
  }

  .modal-header h2 i {
    color: var(--accent);
    margin-right: 8px;
  }

  .lede {
    color: var(--text-primary);
    font-size: 14px;
    line-height: 1.55;
    margin: 0 0 20px;
  }

  h3 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin: 20px 0 10px;
  }

  .diagram {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--bg-base);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 14px 16px;
  }

  .step {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-primary);
  }

  .step-num {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-on);
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .step-body code {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
    background: var(--bg-overlay);
    padding: 1px 6px;
    border-radius: 3px;
    color: var(--text-secondary);
  }

  .setting-help {
    margin: 0 0 10px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  .setting-help code {
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: var(--text-secondary);
  }

  .snippet-wrap {
    position: relative;
  }

  .snippet {
    margin: 0;
    padding: 12px 14px;
    background: var(--bg-base);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
    color: var(--text-secondary);
    white-space: pre;
    overflow-x: auto;
  }

  .snippet-copy {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 4px 10px;
    font-size: 11px;
    background: var(--bg-button);
    color: var(--text-primary);
    border-radius: 4px;
    border: 1px solid var(--border);
  }

  .snippet-copy:hover:not(:disabled) {
    background: var(--bg-button-hover);
  }

  .snippet-copy:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .callouts {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 20px;
  }

  .callout {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 8px 12px;
    background: var(--bg-base);
    border-left: 3px solid var(--accent);
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-secondary);
  }

  .callout i {
    color: var(--accent);
    margin-top: 2px;
    width: 14px;
    text-align: center;
    flex-shrink: 0;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 24px;
    border-top: 1px solid var(--border);
  }

  .cancel-btn {
    padding: 8px 20px;
    color: var(--text-muted);
    border-radius: 6px;
    transition: color 0.15s;
  }

  .cancel-btn:hover {
    color: var(--text-secondary);
  }

  .enable-btn {
    padding: 8px 24px;
    background: var(--accent);
    color: var(--accent-on);
    border-radius: 6px;
    font-weight: 600;
    transition: background 0.15s;
  }

  .enable-btn:hover {
    background: var(--accent-hover);
  }
</style>

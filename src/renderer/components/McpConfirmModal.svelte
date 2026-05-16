<script>
  // Confirm-before-write modal for MCP tool calls.
  // Driven by main via `mcp:confirm-request`; replies via `respondMcpConfirm`.
  // Pass `request` { id, tool, summary, args } and `onClose` (called after a
  // decision is sent). App.svelte holds a queue and presents one at a time.

  let { request, onResolve } = $props();

  let showDetails = $state(false);

  function decide(decision) {
    onResolve(decision);
  }

  function focusOnMount(node) { node.focus(); }

  function handleKeydown(e) {
    if (e.key === 'Escape') decide('deny');
    if (e.key === 'Enter') decide('allow');
  }

  // Pretty-printed args for the collapsible "Details" disclosure. base64
  // payloads on add_attachment can be huge — truncate dataBase64 so the
  // dialog stays readable instead of dumping a megabyte of text into the DOM.
  let prettyArgs = $derived.by(() => {
    if (!request?.args) return '';
    const cloned = { ...request.args };
    if (typeof cloned.dataBase64 === 'string' && cloned.dataBase64.length > 80) {
      cloned.dataBase64 = `<${cloned.dataBase64.length} bytes base64>`;
    }
    if (typeof cloned.body === 'string' && cloned.body.length > 400) {
      cloned.body = cloned.body.slice(0, 400) + `… (+${cloned.body.length - 400} more chars)`;
    }
    try { return JSON.stringify(cloned, null, 2); }
    catch { return String(cloned); }
  });
</script>

<div
  class="modal-overlay"
  use:focusOnMount
  onkeydown={handleKeydown}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <div class="modal">
    <div class="modal-header">
      <h2><i class="fas fa-shield-halved"></i> MCP write request</h2>
    </div>
    <div class="modal-body">
      <p class="prompt">An MCP client wants to run a tool that will modify this project.</p>

      <div class="kv">
        <span class="k">Tool</span>
        <code class="v tool-name">{request.tool}</code>
      </div>
      <div class="kv">
        <span class="k">Action</span>
        <span class="v">{request.summary}</span>
      </div>

      <button class="details-toggle" onclick={() => showDetails = !showDetails}>
        <i class="fas fa-chevron-{showDetails ? 'down' : 'right'}"></i>
        {showDetails ? 'Hide' : 'Show'} raw arguments
      </button>
      {#if showDetails}
        <pre class="args">{prettyArgs}</pre>
      {/if}

      <p class="hint">
        "Allow for session" trusts every <code>{request.tool}</code> call until you close
        the project or quit NoteLiner. Allow once approves just this call.
      </p>

      <div class="modal-footer">
        <button class="deny-btn" onclick={() => decide('deny')}>Deny</button>
        <button class="session-btn" onclick={() => decide('session')}>Allow for session</button>
        <button class="allow-btn" onclick={() => decide('allow')}>Allow once</button>
      </div>
    </div>
  </div>
</div>

<style>
  .modal-header h2 i {
    color: var(--accent);
    margin-right: 8px;
  }

  .prompt {
    color: var(--text-primary);
    font-size: 14px;
    margin: 0 0 16px;
    line-height: 1.5;
  }

  .kv {
    display: flex;
    gap: 12px;
    margin-bottom: 8px;
    align-items: baseline;
    font-size: 13px;
  }

  .k {
    width: 70px;
    flex-shrink: 0;
    color: var(--text-muted);
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.05em;
  }

  .v {
    color: var(--text-primary);
    word-break: break-word;
  }

  .tool-name {
    background: var(--bg-base);
    padding: 2px 8px;
    border-radius: 4px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
  }

  .details-toggle {
    margin: 12px 0 0;
    padding: 4px 0;
    font-size: 12px;
    color: var(--accent);
    background: transparent;
  }

  .details-toggle:hover {
    text-decoration: underline;
  }

  .args {
    margin: 8px 0 0;
    padding: 10px 12px;
    background: var(--bg-base);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 11px;
    color: var(--text-secondary);
    max-height: 240px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .hint {
    margin: 16px 0 20px;
    padding: 8px 12px;
    background: var(--bg-base);
    border-left: 3px solid var(--accent);
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 12px;
    line-height: 1.5;
  }

  .hint code {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 11px;
    color: var(--text-secondary);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .deny-btn,
  .session-btn,
  .allow-btn {
    padding: 8px 18px;
    font-size: 13px;
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
  }

  .deny-btn {
    color: var(--text-muted);
  }

  .deny-btn:hover {
    color: #e06060;
  }

  .session-btn {
    background: var(--bg-button);
    color: var(--text-primary);
  }

  .session-btn:hover {
    background: var(--bg-button-hover);
  }

  .allow-btn {
    background: var(--accent);
    color: var(--accent-on);
    font-weight: 600;
  }

  .allow-btn:hover {
    background: var(--accent-hover);
  }
</style>

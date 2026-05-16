<script>
  import { onMount } from 'svelte';
  import { themeState } from '../stores/theme.svelte.js';
  import { commandRegistry } from '../stores/commands.svelte.js';
  import McpWalkthroughModal from './McpWalkthroughModal.svelte';

  let { onClose } = $props();

  let activeTab = $state('ui');
  let customTitlebar = $state(false);
  let customTitlebarInitial = $state(false);
  let writeFrontmatter = $state(true);
  let mcpEnabled = $state(false);
  let mcpConfirmWrites = $state(false);
  let mcpDisabledTools = $state([]);
  let showMcpWalkthrough = $state(false);
  let mcpStatus = $state(null);
  let copiedConfig = $state(false);
  let prefsLoaded = $state(false);

  async function refreshMcpStatus() {
    if (window.api?.getMcpStatus) {
      try { mcpStatus = await window.api.getMcpStatus(); }
      catch { mcpStatus = null; }
    }
  }

  onMount(async () => {
    if (window.api?.getUIPrefs) {
      try {
        const prefs = await window.api.getUIPrefs();
        customTitlebar = !!prefs?.customTitlebar;
        customTitlebarInitial = customTitlebar;
        writeFrontmatter = prefs?.writeFrontmatter !== false;
        mcpEnabled = !!prefs?.mcpEnabled;
        mcpConfirmWrites = !!prefs?.mcpConfirmWrites;
        mcpDisabledTools = Array.isArray(prefs?.mcpDisabledTools) ? [...prefs.mcpDisabledTools] : [];
      } catch { /* ignore */ }
    }
    await refreshMcpStatus();
    prefsLoaded = true;
  });

  async function toggleCustomTitlebar() {
    customTitlebar = !customTitlebar;
    if (window.api?.setUIPrefs) {
      try {
        await window.api.setUIPrefs({ customTitlebar });
      } catch { /* ignore */ }
    }
  }

  async function toggleWriteFrontmatter() {
    writeFrontmatter = !writeFrontmatter;
    if (window.api?.setUIPrefs) {
      try {
        await window.api.setUIPrefs({ writeFrontmatter });
      } catch { /* ignore */ }
    }
  }

  async function toggleMcp() {
    // Every off→on transition opens the walkthrough as a confirmation gate.
    // The toggle only commits if the user clicks "Enable" inside the modal.
    // Off-direction (disabling) flips silently — no value in nagging there.
    if (!mcpEnabled) {
      // Make sure mcpStatus.bridgePath is populated before opening — the
      // walkthrough's config snippet depends on it.
      if (!mcpStatus?.bridgePath) await refreshMcpStatus();
      showMcpWalkthrough = true;
      return;
    }
    mcpEnabled = false;
    if (window.api?.setUIPrefs) {
      try {
        await window.api.setUIPrefs({ mcpEnabled: false });
      } catch { /* ignore */ }
    }
    await refreshMcpStatus();
  }

  async function handleWalkthroughEnable() {
    showMcpWalkthrough = false;
    mcpEnabled = true;
    if (window.api?.setUIPrefs) {
      try {
        await window.api.setUIPrefs({ mcpEnabled: true });
      } catch { /* ignore */ }
    }
    await refreshMcpStatus();
  }

  function handleWalkthroughCancel() {
    // Toggle stays off — the modal acts purely as a consent gate.
    showMcpWalkthrough = false;
  }

  async function toggleMcpConfirmWrites() {
    mcpConfirmWrites = !mcpConfirmWrites;
    if (window.api?.setUIPrefs) {
      try {
        await window.api.setUIPrefs({ mcpConfirmWrites });
      } catch { /* ignore */ }
    }
  }

  async function toggleToolDisabled(tool) {
    if (mcpDisabledTools.includes(tool)) {
      mcpDisabledTools = mcpDisabledTools.filter(t => t !== tool);
    } else {
      mcpDisabledTools = [...mcpDisabledTools, tool];
    }
    if (window.api?.setUIPrefs) {
      try {
        await window.api.setUIPrefs({ mcpDisabledTools });
      } catch { /* ignore */ }
    }
  }

  // Tool lists come from main via getMcpStatus so the source of truth is the
  // service itself — no chance of the UI listing a tool that doesn't exist.
  let readTools = $derived(mcpStatus?.tools?.read || []);
  let writeTools = $derived(mcpStatus?.tools?.write || []);

  // Sample config snippet — uses the resolved bridge path so a paste works
  // verbatim. node-style spawn is the universal denominator across clients.
  let mcpConfigSnippet = $derived(mcpStatus?.bridgePath
    ? JSON.stringify({
        mcpServers: {
          noteliner: {
            command: 'node',
            args: [mcpStatus.bridgePath],
          },
        },
      }, null, 2)
    : '');

  async function copyMcpConfig() {
    if (!mcpConfigSnippet) return;
    try {
      await navigator.clipboard.writeText(mcpConfigSnippet);
      copiedConfig = true;
      setTimeout(() => { copiedConfig = false; }, 1500);
    } catch { /* ignore */ }
  }

  let mcpStatusText = $derived(
    !mcpStatus ? '…'
    : !mcpStatus.enabled ? 'Disabled'
    : !mcpStatus.projectOpen ? 'Idle (no project open)'
    : mcpStatus.running ? 'Running'
    : 'Stopped'
  );

  async function applyRestart() {
    if (window.api?.relaunchApp) {
      await window.api.relaunchApp();
    }
  }

  let restartPending = $derived(prefsLoaded && customTitlebar !== customTitlebarInitial);

  // Derived from the command registry — single source of truth for shortcuts.
  // Adding a new keyboard shortcut means adding the command in App.svelte's
  // registerCommands(); this list updates automatically.
  const shortcuts = $derived(commandRegistry.shortcutList());

  // CodeMirror-handled shortcuts that aren't NoteLiner commands but are worth
  // documenting alongside.
  const editorShortcuts = [
    { keys: 'Ctrl+Shift+F', action: 'Find in File', section: 'Editor' },
  ];

  function focusOnMount(node) {
    node.focus();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' || e.key === 'Enter') onClose();
  }
</script>

<div class="modal-overlay" use:focusOnMount onclick={(e) => { if (e.target === e.currentTarget) onClose(); }} onkeydown={handleKeydown} role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal">
    <div class="modal-header">
      <h2>Settings</h2>
    </div>

    <div class="tab-bar">
      <button class="tab" class:active={activeTab === 'ui'} onclick={() => activeTab = 'ui'}>UI</button>
      <button class="tab" class:active={activeTab === 'mcp'} onclick={() => { activeTab = 'mcp'; refreshMcpStatus(); }}>MCP</button>
      <button class="tab" class:active={activeTab === 'shortcuts'} onclick={() => activeTab = 'shortcuts'}>Keyboard Shortcuts</button>
    </div>

    <div class="modal-body">
      {#if activeTab === 'ui'}
        <div class="setting-group">
          <span class="setting-label">Theme</span>
          <div class="theme-list">
            {#each themeState.list as theme (theme.id)}
              <button
                class="theme-option"
                class:active={themeState.current === theme.id}
                onclick={() => themeState.set(theme.id)}
              >
                <span class="theme-radio">
                  {#if themeState.current === theme.id}
                    <i class="fas fa-circle-check"></i>
                  {:else}
                    <i class="far fa-circle"></i>
                  {/if}
                </span>
                {theme.name}
              </button>
            {/each}
          </div>
        </div>

        <div class="setting-group">
          <span class="setting-label">UI Scale</span>
          <div class="scale-list">
            {#each themeState.scaleList as scale (scale.id)}
              <button
                class="scale-option"
                class:active={themeState.scale === scale.id}
                onclick={() => themeState.setScale(scale.id)}
              >
                {scale.label}
              </button>
            {/each}
          </div>
        </div>

        <div class="setting-group">
          <span class="setting-label">Window</span>
          <button
            class="toggle-option"
            class:active={customTitlebar}
            onclick={toggleCustomTitlebar}
            disabled={!prefsLoaded}
          >
            <span class="toggle-radio">
              {#if customTitlebar}
                <i class="fas fa-square-check"></i>
              {:else}
                <i class="far fa-square"></i>
              {/if}
            </span>
            Custom Window Titlebar
          </button>
          {#if restartPending}
            <div class="restart-banner">
              <span>Restart required to apply titlebar change.</span>
              <button class="restart-btn" onclick={applyRestart}>Restart now</button>
            </div>
          {/if}
        </div>

        <div class="setting-group">
          <span class="setting-label">Storage</span>
          <button
            class="toggle-option"
            class:active={writeFrontmatter}
            onclick={toggleWriteFrontmatter}
            disabled={!prefsLoaded}
          >
            <span class="toggle-radio">
              {#if writeFrontmatter}
                <i class="fas fa-square-check"></i>
              {:else}
                <i class="far fa-square"></i>
              {/if}
            </span>
            Write YAML frontmatter to .md files
          </button>
          <p class="setting-help">
            Mirrors id, name, and tags into a YAML block at the top of each
            note so external tools can read them. Applies to future saves;
            files are reconciled on next project open.
          </p>
        </div>
      {:else if activeTab === 'mcp'}
        <div class="setting-group">
          <span class="setting-label">Model Context Protocol Server</span>
          <button
            class="toggle-option"
            class:active={mcpEnabled}
            onclick={toggleMcp}
            disabled={!prefsLoaded}
          >
            <span class="toggle-radio">
              {#if mcpEnabled}
                <i class="fas fa-square-check"></i>
              {:else}
                <i class="far fa-square"></i>
              {/if}
            </span>
            Enable MCP server
          </button>
          <p class="setting-help">
            Lets external AI assistants (Claude Code, Claude Desktop, Cursor)
            list, read, search, and write notes in the currently-open project.
            All writes go through the normal save path and are committed to
            git. The server is local-only — no network port is opened.
          </p>
        </div>

        <div class="setting-group">
          <span class="setting-label">Status</span>
          <div class="mcp-status-row">
            <span class="mcp-status-dot" class:running={mcpStatus?.running}></span>
            <span class="mcp-status-text">{mcpStatusText}</span>
            <button class="link-btn" onclick={refreshMcpStatus}>Refresh</button>
          </div>
          {#if mcpStatus?.socketPath}
            <div class="mcp-kv">
              <span class="mcp-k">Socket</span>
              <code class="mcp-v">{mcpStatus.socketPath}</code>
            </div>
          {/if}
          {#if mcpStatus?.bridgePath}
            <div class="mcp-kv">
              <span class="mcp-k">Bridge</span>
              <code class="mcp-v">{mcpStatus.bridgePath}</code>
            </div>
          {/if}
        </div>

        {#if mcpEnabled && mcpConfigSnippet}
          <div class="setting-group">
            <span class="setting-label">Client Configuration</span>
            <p class="setting-help">
              Paste this into your MCP client's config file (for Claude Code:
              <code>.mcp.json</code> in the project; for Claude Desktop:
              <code>claude_desktop_config.json</code>).
            </p>
            <div class="snippet-wrap">
              <pre class="snippet">{mcpConfigSnippet}</pre>
              <button class="snippet-copy" onclick={copyMcpConfig}>
                {copiedConfig ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        {/if}

        <div class="setting-group">
          <span class="setting-label">Safety</span>
          <button
            class="toggle-option"
            class:active={mcpConfirmWrites}
            onclick={toggleMcpConfirmWrites}
            disabled={!prefsLoaded || !mcpEnabled}
          >
            <span class="toggle-radio">
              {#if mcpConfirmWrites}
                <i class="fas fa-square-check"></i>
              {:else}
                <i class="far fa-square"></i>
              {/if}
            </span>
            Ask before write operations
          </button>
          <p class="setting-help">
            When enabled, NoteLiner asks for permission before running write
            tools (<code>create_note</code>, <code>update_note</code>,
            <code>delete_note</code>, etc.). Read tools are never gated.
            "Allow for session" remembers your choice until the project closes.
          </p>
        </div>

        {#if mcpStatus?.tools}
          <div class="setting-group">
            <span class="setting-label">Tool Access</span>
            <p class="setting-help">
              Untick to disable individual tools. Disabled tools return an
              error to the MCP client. This applies to both read and write
              tools — handy for restricting an agent's reach without turning
              the whole server off.
            </p>

            <div class="tool-section">
              <span class="tool-section-label">Read</span>
              {#each readTools as tool (tool)}
                {@const disabled = mcpDisabledTools.includes(tool)}
                <button
                  class="tool-row"
                  class:disabled
                  onclick={() => toggleToolDisabled(tool)}
                  disabled={!prefsLoaded || !mcpEnabled}
                >
                  <span class="tool-check">
                    {#if !disabled}
                      <i class="fas fa-square-check"></i>
                    {:else}
                      <i class="far fa-square"></i>
                    {/if}
                  </span>
                  <code class="tool-name">{tool}</code>
                </button>
              {/each}
            </div>

            <div class="tool-section">
              <span class="tool-section-label">Write</span>
              {#each writeTools as tool (tool)}
                {@const disabled = mcpDisabledTools.includes(tool)}
                <button
                  class="tool-row"
                  class:disabled
                  onclick={() => toggleToolDisabled(tool)}
                  disabled={!prefsLoaded || !mcpEnabled}
                >
                  <span class="tool-check">
                    {#if !disabled}
                      <i class="fas fa-square-check"></i>
                    {:else}
                      <i class="far fa-square"></i>
                    {/if}
                  </span>
                  <code class="tool-name">{tool}</code>
                  <span class="tool-tag">write</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {:else if activeTab === 'shortcuts'}
        <div class="shortcuts-list">
          {#each [...shortcuts, ...editorShortcuts] as shortcut, i (shortcut.section + '|' + shortcut.keys + '|' + i)}
            {#if i === 0 || shortcut.section !== [...shortcuts, ...editorShortcuts][i - 1].section}
              <div class="shortcut-section">{shortcut.section}</div>
            {/if}
            <div class="shortcut-row">
              <span class="shortcut-action">{shortcut.action}</span>
              <kbd class="shortcut-keys">{shortcut.keys}</kbd>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="close-btn" onclick={onClose}>OK</button>
    </div>
  </div>
</div>

{#if showMcpWalkthrough}
  <McpWalkthroughModal
    bridgePath={mcpStatus?.bridgePath || ''}
    onEnable={handleWalkthroughEnable}
    onCancel={handleWalkthroughCancel}
  />
{/if}

<style>
  .tab-bar {
    display: flex;
    border-bottom: 1px solid var(--border);
    padding: 0 24px;
    gap: 0;
    flex-shrink: 0;
  }

  .tab {
    padding: 10px 16px;
    font-size: 13px;
    color: var(--text-muted);
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
    margin-bottom: -1px;
  }

  .tab:hover {
    color: var(--text-primary);
  }

  .tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    padding: 12px 24px;
    border-top: 1px solid var(--border);
  }

  .setting-group {
    margin-bottom: 24px;
  }

  .setting-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    display: block;
    margin-bottom: 10px;
  }

  .theme-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .theme-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--bg-button);
    color: var(--text-primary);
    border-radius: 6px;
    font-size: 14px;
    text-align: left;
    transition: background 0.15s;
  }

  .theme-option:hover {
    background: var(--bg-button-hover);
  }

  .theme-option.active {
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
  }

  .theme-radio {
    color: var(--text-muted);
    font-size: 15px;
    width: 18px;
    text-align: center;
  }

  .theme-option.active .theme-radio {
    color: var(--accent);
  }

  .scale-list {
    display: flex;
    gap: 4px;
  }

  .scale-option {
    padding: 8px 14px;
    background: var(--bg-button);
    color: var(--text-primary);
    border-radius: 6px;
    font-size: 13px;
    transition: background 0.15s;
  }

  .scale-option:hover {
    background: var(--bg-button-hover);
  }

  .scale-option.active {
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
  }

  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .shortcut-section {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    padding: 12px 12px 4px;
  }

  .shortcut-section:first-child {
    padding-top: 0;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-radius: 6px;
  }

  .shortcut-row:nth-child(odd) {
    background: var(--bg-base);
  }

  .shortcut-action {
    font-size: 13px;
    color: var(--text-primary);
  }

  .shortcut-keys {
    font-size: 12px;
    font-family: monospace;
    color: var(--text-secondary);
    background: var(--bg-button);
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid var(--border);
  }

  .toggle-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--bg-button);
    color: var(--text-primary);
    border-radius: 6px;
    font-size: 14px;
    text-align: left;
    transition: background 0.15s;
    width: 100%;
  }

  .toggle-option:hover:not(:disabled) {
    background: var(--bg-button-hover);
  }

  .toggle-option.active {
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
  }

  .toggle-option:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .toggle-radio {
    color: var(--text-muted);
    font-size: 15px;
    width: 18px;
    text-align: center;
  }

  .toggle-option.active .toggle-radio {
    color: var(--accent);
  }

  .setting-help {
    margin: 8px 2px 0;
    font-size: 12px;
    line-height: 1.4;
    color: var(--text-muted);
  }

  .restart-banner {
    margin-top: 10px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: var(--bg-selected);
    border: 1px solid var(--accent);
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-primary);
  }

  .restart-btn {
    padding: 6px 14px;
    background: var(--accent);
    color: var(--accent-on);
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    transition: background 0.15s;
  }

  .restart-btn:hover {
    background: var(--accent-hover);
  }

  .mcp-status-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-primary);
  }

  .mcp-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-faint);
  }

  .mcp-status-dot.running {
    background: #2ea043;
    box-shadow: 0 0 6px rgba(46, 160, 67, 0.6);
  }

  .mcp-status-text {
    flex: 1;
  }

  .mcp-kv {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
    font-size: 12px;
  }

  .mcp-k {
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted);
    width: 60px;
    flex-shrink: 0;
  }

  .mcp-v {
    color: var(--text-secondary);
    font-family: 'SF Mono', 'Fira Code', monospace;
    word-break: break-all;
  }

  .link-btn {
    font-size: 12px;
    color: var(--accent);
    background: transparent;
    padding: 0;
  }

  .link-btn:hover {
    text-decoration: underline;
  }

  .snippet-wrap {
    position: relative;
    margin-top: 8px;
  }

  .snippet {
    background: var(--bg-base);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px 14px;
    margin: 0;
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

  .snippet-copy:hover {
    background: var(--bg-button-hover);
  }

  .tool-section {
    margin-top: 8px;
  }

  .tool-section-label {
    display: block;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
    margin: 8px 0 4px;
  }

  .tool-row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 6px 10px;
    background: transparent;
    border-radius: 4px;
    font-size: 13px;
    color: var(--text-primary);
    text-align: left;
    transition: background 0.15s;
  }

  .tool-row:hover:not(:disabled) {
    background: var(--bg-button);
  }

  .tool-row:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .tool-row.disabled .tool-name {
    color: var(--text-muted);
    text-decoration: line-through;
  }

  .tool-check {
    width: 18px;
    text-align: center;
    color: var(--accent);
  }

  .tool-row.disabled .tool-check {
    color: var(--text-faint);
  }

  .tool-name {
    flex: 1;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
  }

  .tool-tag {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
    background: var(--bg-base);
    padding: 1px 6px;
    border-radius: 3px;
  }

  .close-btn {
    padding: 8px 24px;
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
  }

  .close-btn:hover {
    background: var(--accent);
    color: var(--accent-on);
  }
</style>

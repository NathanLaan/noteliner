<script>
  import { themeState } from '../stores/theme.svelte.js';

  let { onClose } = $props();

  let activeTab = $state('ui');

  const shortcuts = [
    { keys: 'Ctrl+N', action: 'New File' },
    { keys: 'Ctrl+O', action: 'Open Folder' },
    { keys: 'Ctrl+P', action: 'Toggle Preview' },
    { keys: 'Ctrl+B', action: 'Toggle Attachments' },
    { keys: 'Ctrl+L', action: 'Toggle Log Panel' },
    { keys: 'Ctrl+,', action: 'Settings' },
    { keys: 'Ctrl+Shift+,', action: 'Project Settings' },
    { keys: 'Ctrl+Shift+S', action: 'Remote Sync' },
    { keys: 'Ctrl+I', action: 'About' },
    { keys: 'Ctrl++', action: 'Zoom In' },
    { keys: 'Ctrl+-', action: 'Zoom Out' },
    { keys: 'Ctrl+0', action: 'Zoom Reset' },
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
      {:else if activeTab === 'shortcuts'}
        <div class="shortcuts-list">
          {#each shortcuts as shortcut (shortcut.keys)}
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

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--modal-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    min-width: 380px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    background: var(--modal-header-bg);
    padding: 16px 24px;
    flex-shrink: 0;
  }

  .modal-header h2 {
    font-size: 14px;
    font-weight: 600;
    color: var(--modal-header-text);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

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

  .modal-body {
    padding: 24px 24px 20px;
    min-height: 200px;
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

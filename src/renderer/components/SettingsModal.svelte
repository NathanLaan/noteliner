<script>
  import { onMount } from 'svelte';
  import { themeState } from '../stores/theme.svelte.js';
  import { commandRegistry } from '../stores/commands.svelte.js';

  let { onClose } = $props();

  let activeTab = $state('ui');
  let customTitlebar = $state(false);
  let customTitlebarInitial = $state(false);
  let prefsLoaded = $state(false);

  onMount(async () => {
    if (window.api?.getUIPrefs) {
      try {
        const prefs = await window.api.getUIPrefs();
        customTitlebar = !!prefs?.customTitlebar;
        customTitlebarInitial = customTitlebar;
      } catch { /* ignore */ }
    }
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

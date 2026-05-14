<script>
  let {
    onToggleToolbar,
    toolbarVisible = true,
    onGoHome,
    onOpenFolder,
    onNewFile,
    onImportDocument,
    projectOpen = false,
  } = $props();

  let isMaximized = $state(false);

  async function refreshMaximized() {
    if (window.api?.windowIsMaximized) {
      isMaximized = await window.api.windowIsMaximized();
    }
  }

  $effect(() => {
    refreshMaximized();
    const unsub = window.api?.onWindowMaximizedChange?.((v) => { isMaximized = v; });
    return () => { if (unsub) unsub(); };
  });

  function onTitlebarDblClick(e) {
    // Ignore double-clicks on buttons — only the drag region should trigger max/restore
    if (e.target.closest('button')) return;
    window.api?.windowMaximize();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="titlebar" ondblclick={onTitlebarDblClick}>
  <button
    class="titlebar-btn toolbar-toggle"
    class:active={toolbarVisible}
    onclick={onToggleToolbar}
    title="Toolbar (Ctrl+Shift+E)"
  >
    <i class="fas fa-bars"></i>
  </button>

  <div class="titlebar-actions">
    <button
      class="titlebar-btn"
      class:active={!projectOpen}
      onclick={onGoHome}
      disabled={!projectOpen}
      title="Home"
    >
      <i class="fas fa-house"></i>
    </button>
    <button class="titlebar-btn" onclick={onOpenFolder} title="Open Folder (Ctrl+O)">
      <i class="fas fa-folder-open"></i>
    </button>
    {#if projectOpen}
      <button class="titlebar-btn" onclick={onNewFile} title="New File (Ctrl+N)">
        <i class="fas fa-file-circle-plus"></i>
      </button>
      <button class="titlebar-btn" onclick={onImportDocument} title="Import Document (Ctrl+Shift+I)">
        <i class="fas fa-file-import"></i>
      </button>
    {/if}
  </div>

  <div class="titlebar-title">NoteLiner</div>

  <div class="titlebar-controls">
    <button class="titlebar-btn" onclick={() => window.api?.windowMinimize()} title="Minimize">
      <i class="fas fa-window-minimize"></i>
    </button>
    <button
      class="titlebar-btn"
      onclick={() => window.api?.windowMaximize()}
      title={isMaximized ? 'Restore' : 'Maximize'}
    >
      <i class={isMaximized ? 'fas fa-window-restore' : 'fas fa-window-maximize'}></i>
    </button>
    <button class="titlebar-btn close" onclick={() => window.api?.windowClose()} title="Close">
      <i class="fas fa-xmark"></i>
    </button>
  </div>
</div>

<style>
  .titlebar {
    display: flex;
    align-items: center;
    height: 32px;
    background: var(--accent);
    border-bottom: 1px solid var(--accent);
    -webkit-app-region: drag;
    flex-shrink: 0;
    user-select: none;
  }

  .titlebar-btn {
    -webkit-app-region: no-drag;
    width: 48px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-on);
    opacity: 0.75;
    font-size: 12px;
    background: transparent;
    border: none;
    transition: background 0.15s, opacity 0.15s;
  }

  .titlebar-btn:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.18);
    opacity: 1;
  }

  .titlebar-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .titlebar-btn.active {
    opacity: 1;
    background: rgba(0, 0, 0, 0.12);
  }

  .titlebar-actions {
    display: flex;
    -webkit-app-region: no-drag;
  }

  .titlebar-btn.close:hover {
    background: #e81123;
    color: #ffffff;
    opacity: 1;
  }

  .titlebar-title {
    flex: 1;
    text-align: center;
    font-size: 12px;
    color: var(--accent-on);
    opacity: 0.9;
    padding: 0 8px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    -webkit-app-region: drag;
  }

  .titlebar-controls {
    display: flex;
    align-items: center;
    -webkit-app-region: no-drag;
  }
</style>

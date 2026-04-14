<script>
  let { onGoHome, onOpenFolder, onNewFile, onDeleteFile, onToggleSidebar, onToggleOutline, onToggleTagGroups, onToggleLog, onToggleAttachments, onShowAbout, onShowSettings, onShowProjectSettings, onShowSync, projectOpen, hasSelectedFile = false, logVisible = false, sidebarVisible = true, outlineVisible = false, tagGroupsVisible = false, attachmentsVisible = false } = $props();
</script>

<div class="toolbar">
  {#if projectOpen}
    <button class="toolbar-btn" onclick={onGoHome} title="Home">
      <i class="fas fa-house"></i>
    </button>
  {/if}

  <button class="toolbar-btn" onclick={onOpenFolder} title="Open Folder (Ctrl+O)">
    <i class="fas fa-folder-open"></i>
  </button>

  {#if projectOpen}
    <button class="toolbar-btn" onclick={onNewFile} title="New File (Ctrl+N)">
      <i class="fas fa-file-circle-plus"></i>
    </button>

    <button class="toolbar-btn" onclick={onDeleteFile} disabled={!hasSelectedFile} title="Delete File (Ctrl+D)">
      <i class="fas fa-file-circle-minus"></i>
    </button>

    <button class="toolbar-btn" class:active={sidebarVisible} onclick={onToggleSidebar} title="Toggle Files Panel (Ctrl+E)">
      <i class="fas fa-bars-staggered"></i>
    </button>

    <button class="toolbar-btn" class:active={outlineVisible} onclick={onToggleOutline} title="Toggle Outline (Ctrl+Shift+O)">
      <i class="fas fa-list-ol"></i>
    </button>

    <button class="toolbar-btn" class:active={tagGroupsVisible} onclick={onToggleTagGroups} title="Toggle Tag Groups (Ctrl+G)">
      <i class="fas fa-tags"></i>
    </button>

    <button class="toolbar-btn" class:active={attachmentsVisible} onclick={onToggleAttachments} title="Attachments (Ctrl+B)">
      <i class="fas fa-paperclip"></i>
    </button>

    <button class="toolbar-btn" onclick={onShowSync} title="Remote Sync (Ctrl+Shift+S)">
      <i class="fas fa-cloud-arrow-up"></i>
    </button>
  {/if}

  <div class="toolbar-spacer"></div>

  <button class="toolbar-btn" class:active={logVisible} onclick={onToggleLog} title="Show Log (Ctrl+L)">
    <i class="fas fa-terminal"></i>
  </button>

  {#if projectOpen}
    <button class="toolbar-btn" onclick={onShowProjectSettings} title="Project Settings (Ctrl+Shift+,)">
      <i class="fas fa-sliders"></i>
    </button>
  {/if}

  <button class="toolbar-btn" onclick={onShowSettings} title="Settings (Ctrl+,)">
    <i class="fas fa-gear"></i>
  </button>

  <button class="toolbar-btn" onclick={onShowAbout} title="About (Ctrl+I)">
    <i class="fas fa-circle-info"></i>
  </button>
</div>

<style>
  .toolbar {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 48px;
    background: var(--bg-overlay);
    border-right: 1px solid var(--border);
    padding: 8px 0;
    flex-shrink: 0;
    gap: 4px;
  }

  .toolbar-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 16px;
    transition: background 0.15s, color 0.15s;
  }

  .toolbar-btn:hover {
    background: var(--bg-button);
    color: var(--text-primary);
  }

  .toolbar-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .toolbar-btn:disabled:hover {
    background: none;
    color: var(--text-secondary);
  }

  .toolbar-btn.active {
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
  }

  .toolbar-spacer {
    flex: 1;
  }
</style>

<script>
  let { onOpenFolder, onNewFile, onToggleLog, onToggleAttachments, onShowAbout, onShowSettings, projectOpen } = $props();
</script>

<div class="toolbar">
  <button class="toolbar-btn" onclick={onOpenFolder} title="Open Folder (Ctrl+O)">
    <i class="fas fa-folder-open"></i>
  </button>

  {#if projectOpen}
    <button class="toolbar-btn" onclick={onNewFile} title="New File">
      <i class="fas fa-file-circle-plus"></i>
    </button>

    <button class="toolbar-btn" onclick={onToggleAttachments} title="Attachments (Ctrl+B)">
      <i class="fas fa-paperclip"></i>
    </button>
  {/if}

  <div class="toolbar-spacer"></div>

  <button class="toolbar-btn" onclick={onToggleLog} title="Show Log (Ctrl+L)">
    <i class="fas fa-terminal"></i>
  </button>

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

  .toolbar-spacer {
    flex: 1;
  }
</style>

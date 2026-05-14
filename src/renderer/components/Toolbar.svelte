<script>
  let { onGoHome, onOpenFolder, onNewFile, onImportDocument, onToggleSidebar, onToggleOutline, onToggleTags, onToggleTagGroups, onToggleLog, onToggleAttachments, onToggleSearch, onToggleBacklinks, onShowAbout, onShowSettings, onShowProjectSettings, onShowSync, onShowHelp, projectOpen, customTitlebar = false, logVisible = false, sidebarVisible = true, outlineVisible = false, tagsVisible = true, tagGroupsVisible = false, attachmentsVisible = false, searchVisible = false, backlinksVisible = false } = $props();
</script>

<div class="toolbar">
  {#if !customTitlebar}
    <button class="toolbar-btn" class:active={!projectOpen} onclick={onGoHome} disabled={!projectOpen} title="Home">
      <i class="fas fa-house"></i>
    </button>

    <button class="toolbar-btn" onclick={onOpenFolder} title="Open Folder (Ctrl+O)">
      <i class="fas fa-folder-open"></i>
    </button>
  {/if}

  {#if projectOpen}
    {#if !customTitlebar}
      <div class="toolbar-divider"></div>

      <button class="toolbar-btn" onclick={onNewFile} title="New File (Ctrl+N)">
        <i class="fas fa-file-circle-plus"></i>
      </button>

      <button class="toolbar-btn" onclick={onImportDocument} title="Import Document (Ctrl+Shift+I)">
        <i class="fas fa-file-import"></i>
      </button>

      <div class="toolbar-divider"></div>
    {/if}

    <button class="toolbar-btn" class:active={sidebarVisible} onclick={onToggleSidebar} title="Files (Ctrl+E)">
      <i class="fas fa-bars-staggered"></i>
    </button>

    <button class="toolbar-btn" class:active={outlineVisible} onclick={onToggleOutline} title="Outline (Ctrl+Shift+O)">
      <i class="fas fa-list-ol"></i>
    </button>

    <button class="toolbar-btn" class:active={tagsVisible} onclick={onToggleTags} title="Tags (Ctrl+Shift+T)">
      <i class="fas fa-tag"></i>
    </button>

    <button class="toolbar-btn" class:active={tagGroupsVisible} onclick={onToggleTagGroups} title="Tag Groups (Ctrl+G)">
      <i class="fas fa-tags"></i>
    </button>

    <button class="toolbar-btn" class:active={attachmentsVisible} onclick={onToggleAttachments} title="Attachments (Ctrl+B)">
      <i class="fas fa-paperclip"></i>
    </button>

    <div class="toolbar-divider"></div>

    <button class="toolbar-btn" class:active={searchVisible} onclick={onToggleSearch} title="Search (Ctrl+F)">
      <i class="fas fa-magnifying-glass"></i>
    </button>

    <button class="toolbar-btn" class:active={backlinksVisible} onclick={onToggleBacklinks} title="Backlinks (Ctrl+Shift+B)">
      <i class="fas fa-link"></i>
    </button>
  {/if}

  <div class="toolbar-spacer"></div>

  {#if projectOpen}
    <button class="toolbar-btn" onclick={onShowSync} title="Remote Sync (Ctrl+Shift+S)">
      <i class="fas fa-cloud-arrow-up"></i>
    </button>
  {/if}

  <button class="toolbar-btn" class:active={logVisible} onclick={onToggleLog} title="Show Log (Ctrl+L)">
    <i class="fas fa-terminal"></i>
  </button>

  <div class="toolbar-divider"></div>

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

  <button class="toolbar-btn" onclick={onShowHelp} title="Help">
    <i class="fas fa-circle-question"></i>
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

  .toolbar-divider {
    width: 24px;
    height: 1px;
    background: var(--border);
    margin: 2px 0;
  }

  .toolbar-spacer {
    flex: 1;
  }
</style>

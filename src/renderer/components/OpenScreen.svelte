<script>
  import { onMount } from 'svelte';

  let { onOpenFolder, onNewProject, onOpenRecent } = $props();

  let recentProjects = $state([]);

  onMount(async () => {
    try {
      recentProjects = await window.api.getRecentProjects();
    } catch { /* ignore */ }
  });

  function formatPath(p) {
    const home = '~';
    if (p.startsWith('/home/')) {
      const parts = p.split('/');
      return home + p.slice(('/home/' + parts[2]).length);
    }
    return p;
  }
</script>

<div class="open-screen">
  <div class="open-content">
    <h1 class="app-title">NoteLiner</h1>
    <p class="app-subtitle">An outliner for your thoughts</p>

    <div class="button-bar">
      <button class="action-btn" onclick={onNewProject}>
        <i class="fas fa-plus"></i>
        New Project
      </button>
      <button class="action-btn" onclick={onOpenFolder}>
        <i class="fas fa-folder-open"></i>
        Open Project
      </button>
    </div>

    {#if recentProjects.length > 0}
      <div class="recent-section">
        <span class="recent-label">Recent Projects</span>
        <div class="recent-list">
          {#each recentProjects as project (project.path)}
            <button class="recent-item" onclick={() => onOpenRecent(project.path)}>
              <i class="fas fa-folder"></i>
              <div class="recent-info">
                <span class="recent-name">{project.name}</span>
                <span class="recent-path">{formatPath(project.path)}</span>
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .open-screen {
    flex: 1;
    display: flex;
    background: var(--bg-base);
    padding: 48px;
    overflow-y: auto;
  }

  .open-content {
    max-width: 520px;
  }

  .app-title {
    font-size: 36px;
    font-weight: 300;
    color: var(--text-primary);
    margin-bottom: 6px;
  }

  .app-subtitle {
    font-size: 16px;
    color: var(--text-muted);
    margin-bottom: 28px;
  }

  .button-bar {
    display: flex;
    gap: 10px;
    margin-bottom: 36px;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: var(--bg-button);
    color: var(--text-primary);
    border-radius: 6px;
    font-size: 14px;
    transition: background 0.15s;
  }

  .action-btn:hover {
    background: var(--bg-button-hover);
  }

  .recent-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .recent-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .recent-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 6px;
    text-align: left;
    color: var(--text-primary);
    transition: background 0.1s;
  }

  .recent-item:hover {
    background: var(--bg-item-hover);
  }

  .recent-item i {
    font-size: 16px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .recent-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
  }

  .recent-name {
    font-size: 14px;
    font-weight: 500;
  }

  .recent-path {
    font-size: 12px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>

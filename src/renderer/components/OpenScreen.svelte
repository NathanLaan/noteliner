<script>
  let { onOpenFolder } = $props();
</script>

<div class="open-screen">
  <div class="open-content">
    <h1 class="app-title">NoteLiner</h1>
    <p class="app-subtitle">An outliner for your thoughts</p>
    <button class="open-btn" onclick={onOpenFolder}>
      <i class="fas fa-folder-open"></i>
      Open Folder
    </button>
  </div>
</div>

<style>
  .open-screen {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-base);
  }

  .open-content {
    text-align: center;
  }

  .app-title {
    font-size: 36px;
    font-weight: 300;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .app-subtitle {
    font-size: 16px;
    color: var(--text-muted);
    margin-bottom: 32px;
  }

  .open-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 12px 28px;
    background: var(--bg-button);
    color: var(--text-primary);
    border-radius: 8px;
    font-size: 16px;
    transition: background 0.15s;
  }

  .open-btn:hover {
    background: var(--bg-button-hover);
  }
</style>

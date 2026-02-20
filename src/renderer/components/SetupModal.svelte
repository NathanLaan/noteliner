<script>
  let { folderPath, onSetup, onCancel } = $props();
  let remoteUrl = $state('');
  let mode = $state('choose'); // 'choose' | 'remote'
</script>

<div class="modal-overlay" onclick={onCancel} role="dialog" aria-modal="true">
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <h2>Set Up Project</h2>
    <p class="folder-path">{folderPath}</p>

    {#if mode === 'choose'}
      <p class="prompt">This folder is not a NoteLiner project. How would you like to set it up?</p>
      <div class="btn-group">
        <button class="action-btn" onclick={() => onSetup('')}>
          <i class="fas fa-plus"></i>
          Create New Repository
        </button>
        <button class="action-btn" onclick={() => mode = 'remote'}>
          <i class="fas fa-cloud-arrow-down"></i>
          Clone from Remote
        </button>
      </div>
    {:else}
      <p class="prompt">Enter the remote Git repository URL:</p>
      <input
        class="url-input"
        type="text"
        bind:value={remoteUrl}
        placeholder="https://github.com/user/repo.git"
        onkeydown={(e) => { if (e.key === 'Enter' && remoteUrl.trim()) onSetup(remoteUrl.trim()); }}
      />
      <div class="btn-group">
        <button class="action-btn" onclick={() => mode = 'choose'}>Back</button>
        <button class="action-btn primary" onclick={() => { if (remoteUrl.trim()) onSetup(remoteUrl.trim()); }}>
          Clone
        </button>
      </div>
    {/if}

    <button class="cancel-btn" onclick={onCancel}>Cancel</button>
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
    padding: 32px;
    min-width: 400px;
    text-align: center;
  }

  h2 {
    font-size: 20px;
    font-weight: 400;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .folder-path {
    color: var(--text-muted);
    font-size: 12px;
    margin-bottom: 20px;
    word-break: break-all;
  }

  .prompt {
    color: var(--text-secondary);
    margin-bottom: 16px;
  }

  .btn-group {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-bottom: 16px;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: var(--bg-button);
    color: var(--text-primary);
    border-radius: 6px;
    transition: background 0.15s;
  }

  .action-btn:hover {
    background: var(--bg-button-hover);
  }

  .action-btn.primary {
    background: var(--accent);
    color: var(--accent-on);
  }

  .action-btn.primary:hover {
    background: var(--accent-hover);
  }

  .url-input {
    width: 100%;
    padding: 10px 12px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 6px;
    margin-bottom: 16px;
    outline: none;
  }

  .url-input:focus {
    border-color: var(--input-border-focus);
  }

  .cancel-btn {
    color: var(--text-muted);
    font-size: 13px;
  }

  .cancel-btn:hover {
    color: var(--text-secondary);
  }
</style>

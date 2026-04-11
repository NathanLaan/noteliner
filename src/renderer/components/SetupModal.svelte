<script>
  let { folderPath, onSetup, onCancel } = $props();
  let remoteUrl = $state('');
  let mode = $state('choose'); // 'choose' | 'remote'

  function focusOnMount(node) {
    node.focus();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') onCancel();
  }
</script>

<div class="modal-overlay" use:focusOnMount onclick={(e) => { if (e.target === e.currentTarget) onCancel(); }} onkeydown={handleKeydown} role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal">
    <div class="modal-header">
      <h2>Set Up Project</h2>
    </div>
    <div class="modal-body">
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
</div>

<style>
  .modal {
    text-align: center;
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
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
  }

  .action-btn.primary:hover {
    background: var(--accent);
    color: var(--accent-on);
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

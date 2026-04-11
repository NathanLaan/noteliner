<script>
  import { onMount } from 'svelte';

  let { onConfirm, onCancel } = $props();

  let location = $state('');
  let userName = $state('');
  let userEmail = $state('');
  let error = $state('');

  function focusOnMount(node) {
    node.focus();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter') handleOk();
  }

  async function handleBrowse() {
    const folderPath = await window.api.openFolderDialog();
    if (folderPath) location = folderPath;
  }

  async function handleOk() {
    const trimmedLocation = location.trim();
    const trimmedName = userName.trim();
    const trimmedEmail = userEmail.trim();

    if (!trimmedLocation) {
      error = 'Project location is required.';
      return;
    }
    if (!trimmedName || !trimmedEmail) {
      error = 'User name and email are required.';
      return;
    }

    try {
      await window.api.ensureDir(trimmedLocation);
      onConfirm({ folderPath: trimmedLocation, name: trimmedName, email: trimmedEmail });
    } catch (err) {
      error = `Failed to create directory: ${err.message}`;
    }
  }

  onMount(async () => {
    try {
      const info = await window.api.getSystemInfo();
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      location = `${info.homeDir}/docs/new-project-${yyyy}-${mm}-${dd}`;
      userName = info.username;
      userEmail = `${info.username}@${info.hostname}`;
    } catch { /* use empty defaults */ }
  });
</script>

<div class="modal-overlay" use:focusOnMount onclick={(e) => { if (e.target === e.currentTarget) onCancel(); }} onkeydown={handleKeydown} role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal">
    <div class="modal-header">
      <h2>New Project</h2>
    </div>
    <div class="modal-body">
      {#if error}
        <p class="error-msg">{error}</p>
      {/if}

      <div class="field">
        <label for="project-location">Project Location:</label>
        <div class="field-row">
          <input id="project-location" type="text" bind:value={location} />
          <button class="browse-btn" onclick={handleBrowse} title="Browse for folder">
            <i class="fas fa-folder-open"></i>
          </button>
        </div>
      </div>

      <div class="field">
        <label for="user-name">User Name:</label>
        <input id="user-name" type="text" bind:value={userName} />
      </div>

      <div class="field">
        <label for="user-email">User Email:</label>
        <input id="user-email" type="text" bind:value={userEmail} />
      </div>

      <div class="modal-footer">
        <button class="cancel-btn" onclick={onCancel}>Cancel</button>
        <button class="ok-btn" onclick={handleOk}>OK</button>
      </div>
    </div>
  </div>
</div>

<style>
  .error-msg {
    color: #e06060;
    font-size: 12px;
    margin-bottom: 12px;
  }

  .field {
    margin-bottom: 14px;
  }

  .field label {
    display: block;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }

  .field input {
    width: 100%;
    padding: 8px 12px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
  }

  .field input:focus {
    border-color: var(--input-border-focus);
  }

  .field-row {
    display: flex;
    gap: 8px;
  }

  .field-row input {
    flex: 1;
  }

  .browse-btn {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    color: var(--text-muted);
    background: var(--bg-button);
    font-size: 14px;
    transition: background 0.15s, color 0.15s;
  }

  .browse-btn:hover {
    background: var(--bg-button-hover);
    color: var(--text-primary);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }

  .cancel-btn {
    padding: 8px 20px;
    color: var(--text-muted);
    border-radius: 6px;
    transition: color 0.15s;
  }

  .cancel-btn:hover {
    color: var(--text-secondary);
  }

  .ok-btn {
    padding: 8px 24px;
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
  }

  .ok-btn:hover {
    background: var(--accent);
    color: var(--accent-on);
  }
</style>

<script>
  import { onMount } from 'svelte';
  import { projectState } from '../stores/project.svelte.js';

  let { onClose, required = false } = $props();

  let name = $state('');
  let email = $state('');
  let error = $state('');

  function focusOnMount(node) {
    node.focus();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter') handleSave();
  }

  async function handleSave() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail) {
      error = 'Both name and email are required.';
      return;
    }

    try {
      await window.api.setGitConfig(trimmedName, trimmedEmail);
      onClose();
    } catch (err) {
      error = `Failed to save: ${err.message}`;
    }
  }

  onMount(async () => {
    try {
      const config = await window.api.getGitConfig();
      if (config.name) name = config.name;
      if (config.email) email = config.email;
    } catch { /* no existing config */ }
  });
</script>

<div class="modal-overlay" use:focusOnMount onclick={(e) => { if (e.target === e.currentTarget) onClose(); }} onkeydown={handleKeydown} role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal">
    <div class="modal-header">
      <h2>Project Settings</h2>
    </div>
    <div class="modal-body">
      {#if required}
        <p class="info-msg">Git requires a name and email to save changes. These are stored in the local repository config.</p>
      {/if}

      <div class="setting-group">
        <span class="setting-label">Project Location</span>
        <p class="folder-path">{projectState.folderPath}</p>
      </div>

      <div class="setting-group">
        <span class="setting-label">Git Configuration</span>

        {#if error}
          <p class="error-msg">{error}</p>
        {/if}

        <div class="field">
          <label for="git-name">User Name</label>
          <input id="git-name" type="text" bind:value={name} placeholder="Your Name" />
        </div>

        <div class="field">
          <label for="git-email">User Email</label>
          <input id="git-email" type="text" bind:value={email} placeholder="you@example.com" />
        </div>
      </div>

      <div class="modal-footer">
        <button class="ok-btn" onclick={handleSave}>OK</button>
      </div>
    </div>
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
    min-width: 380px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    background: var(--modal-header-bg);
    padding: 16px 24px;
    flex-shrink: 0;
  }

  .modal-header h2 {
    font-size: 14px;
    font-weight: 600;
    color: var(--modal-header-text);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .modal-body {
    padding: 24px 24px 20px;
  }

  .info-msg {
    color: var(--text-secondary);
    font-size: 13px;
    line-height: 1.5;
    margin-bottom: 20px;
    padding: 10px 12px;
    background: var(--bg-base);
    border-radius: 6px;
    border-left: 3px solid var(--accent);
  }

  .error-msg {
    color: #e06060;
    font-size: 12px;
    margin-bottom: 12px;
  }

  .setting-group {
    margin-bottom: 20px;
  }

  .folder-path {
    font-size: 13px;
    color: var(--text-secondary);
    word-break: break-all;
    padding: 8px 12px;
    background: var(--bg-base);
    border-radius: 6px;
    font-family: monospace;
  }

  .setting-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    display: block;
    margin-bottom: 12px;
  }

  .field {
    margin-bottom: 12px;
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

  .modal-footer {
    display: flex;
    justify-content: flex-end;
  }

  .ok-btn {
    padding: 8px 24px;
    background: var(--bg-button);
    color: var(--text-primary);
    border-radius: 6px;
    transition: background 0.15s;
  }

  .ok-btn:hover {
    background: var(--bg-button-hover);
  }
</style>

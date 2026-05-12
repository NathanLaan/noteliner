<script>
  import { onMount } from 'svelte';
  import { projectState } from '../stores/project.svelte.js';

  let { onClose } = $props();

  let remoteUrl = $state('');
  let savedUrl = $state('');
  let branch = $state('');
  let syncStatus = $state(null);
  let loading = $state(true);
  let operating = $state('');
  let error = $state('');
  let showDisconnectConfirm = $state(false);
  let showResetConfirm = $state(false);

  function focusOnMount(node) {
    node.focus();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') onClose();
  }

  onMount(async () => {
    try {
      const [url, branchName] = await Promise.all([
        window.api.gitGetRemoteUrl(),
        window.api.gitGetBranch()
      ]);
      if (url) {
        remoteUrl = url;
        savedUrl = url;
      }
      if (branchName) branch = branchName;

      if (url) {
        await refreshStatus();
      }
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  });

  async function refreshStatus() {
    syncStatus = null;
    try {
      syncStatus = await window.api.gitGetSyncStatus();
    } catch (err) {
      syncStatus = { status: 'error', message: err.message };
    }
  }

  async function handleConnect() {
    const url = remoteUrl.trim();
    if (!url) {
      error = 'Please enter a remote URL.';
      return;
    }
    error = '';
    operating = 'Connecting...';
    try {
      await window.api.gitSetRemoteUrl(url);
      savedUrl = url;
      await window.api.gitPushUpstream();
      await refreshStatus();
    } catch (err) {
      error = `Connect failed: ${err.message}`;
    } finally {
      operating = '';
    }
  }

  async function handleDisconnect() {
    error = '';
    operating = 'Disconnecting...';
    try {
      await window.api.gitRemoveRemote();
      savedUrl = '';
      remoteUrl = '';
      syncStatus = null;
    } catch (err) {
      error = `Disconnect failed: ${err.message}`;
    } finally {
      operating = '';
    }
  }

  async function handlePush() {
    error = '';
    operating = 'Pushing...';
    try {
      await window.api.gitPush();
      await refreshStatus();
    } catch (err) {
      error = `Push failed: ${err.message}`;
    } finally {
      operating = '';
    }
  }

  async function handlePull() {
    error = '';
    operating = 'Pulling...';
    try {
      await window.api.gitPull();
      await refreshStatus();
    } catch (err) {
      error = `Pull failed: ${err.message}`;
    } finally {
      operating = '';
    }
  }

  async function handlePullRebase() {
    error = '';
    operating = 'Pulling & rebasing...';
    try {
      await window.api.gitPullRebase();
      await refreshStatus();
    } catch (err) {
      error = `Pull & rebase failed: ${err.message}`;
    } finally {
      operating = '';
    }
  }

  async function handleResetFromRemote() {
    showResetConfirm = false;
    error = '';
    operating = 'Resetting...';
    try {
      const result = await window.api.gitResetToRemote();
      if (result && result.index) {
        projectState.load(projectState.folderPath, result.index);
      }
      await refreshStatus();
    } catch (err) {
      error = `Reset failed: ${err.message}`;
    } finally {
      operating = '';
    }
  }

  function statusDotClass(status) {
    if (!status) return '';
    switch (status.status) {
      case 'synced': return 'dot-green';
      case 'ahead': return 'dot-blue';
      case 'behind': return 'dot-orange';
      case 'diverged': return 'dot-red';
      case 'no-upstream': return 'dot-grey';
      case 'error': return 'dot-red';
      default: return 'dot-grey';
    }
  }

  function statusText(status) {
    if (!status) return 'Checking...';
    switch (status.status) {
      case 'synced': return 'Synced — local and remote match';
      case 'ahead': return `Local is ${status.count} commit${status.count !== 1 ? 's' : ''} ahead`;
      case 'behind': return `Local is ${status.count} commit${status.count !== 1 ? 's' : ''} behind`;
      case 'diverged': return `Diverged — ${status.ahead} ahead, ${status.behind} behind`;
      case 'no-upstream': return 'No upstream branch configured';
      case 'error': return status.message || 'Unknown error';
      default: return 'Unknown status';
    }
  }

  let hasRemote = $derived(savedUrl.length > 0);
  let busy = $derived(operating.length > 0);
</script>

<div class="modal-overlay sync-overlay" use:focusOnMount onclick={(e) => { if (e.target === e.currentTarget) onClose(); }} onkeydown={handleKeydown} role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal sync-modal">
    <div class="modal-header">
      <h2>Remote Sync</h2>
    </div>
    <div class="modal-body">
      {#if loading}
        <p class="loading-msg">Loading...</p>
      {:else}
        {#if !hasRemote}
          <p class="info-msg">No remote repository configured. Enter a URL to connect to GitHub, GitLab, or another Git remote.</p>
        {/if}

        {#if error}
          <p class="error-msg">{error}</p>
        {/if}

        <div class="setting-group">
          <span class="setting-label">Remote URL</span>
          <div class="url-row">
            <input
              type="text"
              bind:value={remoteUrl}
              placeholder="https://github.com/user/repo.git"
              disabled={busy}
            />
            {#if hasRemote}
              <button class="icon-btn" onclick={() => showDisconnectConfirm = true} title="Disconnect remote" disabled={busy}>
                <i class="fas fa-xmark"></i>
              </button>
            {/if}
          </div>
        </div>

        <div class="setting-group">
          <span class="setting-label">Branch</span>
          <p class="branch-name">{branch || 'unknown'}</p>
        </div>

        {#if hasRemote}
          <div class="setting-group">
            <span class="setting-label">Status</span>
            <div class="status-row">
              <span class="status-dot {statusDotClass(syncStatus)}"></span>
              <span class="status-text">{statusText(syncStatus)}</span>
              <button class="icon-btn refresh-btn" onclick={refreshStatus} title="Refresh status" disabled={busy}>
                <i class="fas fa-arrows-rotate"></i>
              </button>
            </div>
          </div>
        {/if}

        {#if operating}
          <p class="operating-msg">{operating}</p>
        {/if}

        <div class="modal-footer">
          {#if hasRemote}
            <div class="sync-actions">
              <button class="action-btn" onclick={handlePull} disabled={busy}>
                <i class="fas fa-cloud-arrow-down"></i> Pull
              </button>
              <button class="action-btn" onclick={handlePullRebase} disabled={busy}>
                <i class="fas fa-code-branch"></i> Pull & Rebase
              </button>
              <button class="action-btn" onclick={handlePush} disabled={busy}>
                <i class="fas fa-cloud-arrow-up"></i> Push
              </button>
              <button class="action-btn reset-btn" onclick={() => showResetConfirm = true} disabled={busy}>
                <i class="fas fa-rotate-left"></i> Reset from Remote
              </button>
            </div>
            <button class="close-btn" onclick={onClose}>Close</button>
          {:else}
            <button class="close-btn" onclick={onClose}>Cancel</button>
            <button class="connect-btn" onclick={handleConnect} disabled={busy || !remoteUrl.trim()}>Connect</button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

{#if showDisconnectConfirm}
  <div class="modal-overlay-compact" onclick={(e) => { if (e.target === e.currentTarget) showDisconnectConfirm = false; }} onkeydown={(e) => { if (e.key === 'Escape') showDisconnectConfirm = false; }} role="dialog" aria-modal="true" tabindex="-1">
    <div class="modal-compact">
      <div class="modal-header">
        <h2>Disconnect Remote</h2>
      </div>
      <div class="modal-body">
        <p class="confirm-prompt">Disconnect from the remote repository?</p>
        <p class="confirm-detail">{savedUrl}</p>
        <p class="confirm-note">Your local files will not be deleted.</p>
        <div class="confirm-footer">
          <button class="confirm-cancel-btn" onclick={() => showDisconnectConfirm = false}>Cancel</button>
          <button class="confirm-danger-btn" onclick={() => { showDisconnectConfirm = false; handleDisconnect(); }}>Disconnect</button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showResetConfirm}
  <div class="modal-overlay-compact" onclick={(e) => { if (e.target === e.currentTarget) showResetConfirm = false; }} onkeydown={(e) => { if (e.key === 'Escape') showResetConfirm = false; }} role="dialog" aria-modal="true" tabindex="-1">
    <div class="modal-compact">
      <div class="modal-header">
        <h2>Reset from Remote</h2>
      </div>
      <div class="modal-body">
        <p class="confirm-warning">This will discard ALL local changes and replace your project with the latest version from the remote repository.</p>
        <p class="confirm-warning-sub">This action cannot be undone.</p>
        <div class="confirm-footer">
          <button class="confirm-cancel-btn" onclick={() => showResetConfirm = false}>Cancel</button>
          <button class="confirm-danger-btn" onclick={handleResetFromRemote}>Reset</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .loading-msg {
    color: var(--text-secondary);
    font-size: 13px;
    text-align: center;
    padding: 20px 0;
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

  .operating-msg {
    color: var(--text-secondary);
    font-size: 12px;
    margin-bottom: 12px;
    font-style: italic;
  }

  .setting-group {
    margin-bottom: 16px;
  }

  .setting-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    display: block;
    margin-bottom: 8px;
  }

  .url-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .url-row input {
    flex: 1;
    padding: 8px 12px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 13px;
    font-family: monospace;
    outline: none;
    box-sizing: border-box;
  }

  .url-row input:focus {
    border-color: var(--input-border-focus);
  }

  .url-row input:disabled {
    opacity: 0.6;
  }

  .icon-btn {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    color: var(--text-muted);
    background: var(--bg-button);
    font-size: 14px;
    transition: background 0.15s, color 0.15s;
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--bg-button-hover);
    color: var(--text-primary);
  }

  .icon-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .branch-name {
    font-size: 13px;
    color: var(--text-secondary);
    padding: 6px 12px;
    background: var(--bg-base);
    border-radius: 6px;
    font-family: monospace;
    display: inline-block;
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .dot-green { background: #4ade80; }
  .dot-blue { background: #60a5fa; }
  .dot-orange { background: #fb923c; }
  .dot-red { background: #f87171; }
  .dot-grey { background: #9ca3af; }

  .status-text {
    font-size: 13px;
    color: var(--text-secondary);
    flex: 1;
  }

  .refresh-btn {
    width: 28px;
    height: 28px;
    font-size: 12px;
  }

  /* Main Sync modal: 50% × 50% of the overlay's padded area, pinned to bottom —
     matches the About dialog's reduced-size drawer style. The shared .modal
     class still provides the slide-up animation; only size and position change. */
  .sync-overlay {
    align-items: flex-end;
    justify-content: center;
  }

  .sync-modal {
    width: 50%;
    height: 50%;
    min-width: 480px;
    min-height: 380px;
  }

  /* Flex-column body so the footer can be promoted to the bottom via auto margin. */
  .modal-body {
    display: flex;
    flex-direction: column;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
    margin-top: auto;
  }

  .sync-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    padding: 8px 16px;
    background: var(--bg-button);
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: background 0.15s, color 0.15s;
  }

  .action-btn:hover:not(:disabled) {
    background: var(--bg-button-hover);
    color: var(--text-primary);
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .close-btn {
    padding: 8px 24px;
    background: var(--bg-button);
    border-radius: 6px;
    color: var(--text-secondary);
    transition: background 0.15s, color 0.15s;
  }

  .close-btn:hover {
    background: var(--bg-button-hover);
    color: var(--text-primary);
  }

  .connect-btn {
    padding: 8px 24px;
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
  }

  .connect-btn:hover:not(:disabled) {
    background: var(--accent);
    color: var(--accent-on);
  }

  .connect-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .reset-btn {
    color: #e06060;
  }

  .reset-btn:hover:not(:disabled) {
    color: #e06060;
    background: var(--bg-button-hover);
  }

  .confirm-prompt {
    color: var(--text-primary);
    font-size: 14px;
    margin-bottom: 6px;
    line-height: 1.5;
  }

  .confirm-detail {
    color: var(--text-muted);
    font-size: 12px;
    font-family: monospace;
    margin-bottom: 12px;
    word-break: break-all;
  }

  .confirm-note {
    color: var(--text-secondary);
    font-size: 12px;
    margin-bottom: 24px;
  }

  .confirm-warning {
    color: var(--text-primary);
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 8px;
    padding: 10px 12px;
    background: var(--bg-base);
    border-radius: 6px;
    border-left: 3px solid #e06060;
  }

  .confirm-warning-sub {
    color: var(--text-muted);
    font-size: 12px;
    margin-bottom: 24px;
  }

  .confirm-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .confirm-cancel-btn {
    padding: 8px 20px;
    color: var(--text-muted);
    border-radius: 6px;
    transition: color 0.15s;
  }

  .confirm-cancel-btn:hover {
    color: var(--text-secondary);
  }

  .confirm-danger-btn {
    padding: 8px 24px;
    background: #e06060;
    color: #ffffff;
    border-radius: 6px;
    transition: background 0.15s;
  }

  .confirm-danger-btn:hover {
    background: #c84040;
  }

  .connect-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>

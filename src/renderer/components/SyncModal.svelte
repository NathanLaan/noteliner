<script>
  import { onMount } from 'svelte';

  let { onClose } = $props();

  let remoteUrl = $state('');
  let savedUrl = $state('');
  let branch = $state('');
  let syncStatus = $state(null);
  let loading = $state(true);
  let operating = $state('');
  let error = $state('');

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

<div class="modal-overlay" use:focusOnMount onclick={(e) => { if (e.target === e.currentTarget) onClose(); }} onkeydown={handleKeydown} role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal">
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
              <button class="icon-btn" onclick={handleDisconnect} title="Disconnect remote" disabled={busy}>
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
              <button class="action-btn" onclick={handlePush} disabled={busy}>
                <i class="fas fa-cloud-arrow-up"></i> Push
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
    min-width: 420px;
    max-width: 520px;
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

  .modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
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
</style>

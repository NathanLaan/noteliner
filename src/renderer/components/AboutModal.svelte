<script>
  // Import the SVG's raw markup rather than a URL — inlining via {@html} avoids
  // any dev-server fs.allow / CSP / URL-resolution surprises that can leave the
  // image broken on load.
  import appIconSvg from '../../../assets/icon-hexagon.svg?raw';
  import { updateState } from '../stores/update.svelte.js';

  let { onClose } = $props();

  function focusOnMount(node) {
    node.focus();
  }

  function handleKeydown(e) {
    // Enter is handled by the focused button; don't close on it.
    if (e.key === 'Escape') onClose();
  }

  function openRepo(e) {
    e.preventDefault();
    window.api.openExternal('https://github.com/NathanLaan/noteliner');
  }

  const statusLine = $derived.by(() => {
    switch (updateState.state) {
      case 'checking':    return 'Checking for updates…';
      case 'available':   return `Version ${updateState.version} is available.`;
      case 'downloading': return `Downloading update… ${Math.round(updateState.percent || 0)}%`;
      case 'downloaded':  return `Version ${updateState.version} is ready to install.`;
      case 'unavailable': return updateState.reason === 'dev'
                                  ? 'Updates are disabled in development builds.'
                                  : 'You are running the latest version.';
      case 'error':       return `Update error: ${updateState.error}`;
      default:            return '';
    }
  });
</script>

<div class="modal-overlay about-overlay" use:focusOnMount onclick={(e) => { if (e.target === e.currentTarget) onClose(); }} onkeydown={handleKeydown} role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal about-modal">
    <div class="modal-header">
      <h2>About</h2>
    </div>
    <div class="modal-body">
      <div class="header-row">
        <div class="header-left">
          <p class="app-name">NoteLiner</p>
          <div class="version-row">
            <p class="version">Version {__APP_VERSION__}</p>
            <button
              class="update-btn"
              onclick={() => updateState.check()}
              disabled={updateState.state === 'checking' || updateState.state === 'downloading'}
              title="Check for Updates"
            >
              <i class="fas fa-arrows-rotate" class:spin={updateState.state === 'checking'}></i>
              Check
            </button>
          </div>
          {#if statusLine}
            <p class="update-status" class:is-error={updateState.state === 'error'}>{statusLine}</p>
          {/if}
          {#if updateState.state === 'available'}
            <div class="update-actions">
              <button class="primary-btn" onclick={() => updateState.download()}>Download</button>
            </div>
          {:else if updateState.state === 'downloaded'}
            <div class="update-actions">
              <button class="primary-btn" onclick={() => updateState.install()}>Restart and Install</button>
            </div>
          {/if}
          {#if (updateState.state === 'available' || updateState.state === 'downloaded') && updateState.notes}
            <details class="release-notes">
              <summary>Release notes</summary>
              <div class="release-notes-body">{@html typeof updateState.notes === 'string' ? updateState.notes : ''}</div>
            </details>
          {/if}
          <p class="desc">An outliner-style note-taking application built with Electron and Svelte.</p>
          <p class="repo-link"><a href="https://github.com/NathanLaan/noteliner" onclick={openRepo}>github.com/NathanLaan/noteliner</a></p>
        </div>
        <div class="app-icon" role="img" aria-label="NoteLiner">{@html appIconSvg}</div>
      </div>
      <div class="modal-footer">
        <button class="close-btn" onclick={onClose}>OK</button>
      </div>
    </div>
  </div>
</div>

<style>
  /* About modal: 50% × 50% of the overlay's padded area, pinned to the bottom.
     The shared .modal class still applies the slide-up animation — overriding
     size/position here doesn't affect it. */
  .about-overlay {
    align-items: flex-end;
    justify-content: center;
  }

  .about-modal {
    width: 50%;
    height: 50%;
    min-width: 480px;
    min-height: 380px;
  }

  /* Flex-column the body so the OK button can be promoted to the bottom via
     margin-top: auto. The existing .modal-footer rule keeps it right-aligned. */
  .modal-body {
    display: flex;
    flex-direction: column;
  }

  .modal-footer {
    margin-top: auto;
  }

  .header-row {
    display: flex;
    align-items: flex-start;
    gap: 24px;
    margin-bottom: 8px;
  }

  .header-left {
    flex: 1;
    min-width: 0;
  }

  .app-icon {
    width: 96px;
    height: 96px;
    flex-shrink: 0;
  }

  /* The imported SVG has width/height="512" baked in; override via CSS so it
     scales to the container size rather than rendering at its intrinsic size. */
  .app-icon :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }

  .app-name {
    font-size: 22px;
    font-weight: 400;
    color: var(--text-primary);
    margin-bottom: 6px;
  }

  .version-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .version {
    color: var(--text-muted);
    margin: 0;
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .update-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    background: var(--bg-button);
    color: var(--text-primary);
    font-size: 12px;
    transition: background 0.15s, color 0.15s;
    flex-shrink: 0;
  }

  .update-btn:hover:not(:disabled) {
    background: var(--bg-selected);
    color: var(--accent);
  }

  .update-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .update-btn .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .update-status {
    color: var(--text-secondary);
    font-size: 13px;
    margin-bottom: 12px;
  }

  .update-status.is-error {
    color: var(--danger, #c33);
  }

  .update-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .primary-btn {
    padding: 6px 14px;
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
  }

  .primary-btn:hover {
    background: var(--accent);
    color: var(--accent-on);
  }

  .release-notes {
    margin-bottom: 12px;
    font-size: 13px;
  }

  .release-notes summary {
    cursor: pointer;
    color: var(--accent);
    user-select: none;
  }

  .release-notes-body {
    margin-top: 8px;
    padding: 8px 12px;
    background: var(--bg-overlay);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-secondary);
    max-height: 160px;
    overflow-y: auto;
  }

  .desc {
    color: var(--text-secondary);
    margin-bottom: 16px;
    line-height: 1.5;
  }

  .repo-link {
    margin-bottom: 24px;
  }

  .repo-link a {
    color: var(--accent);
    text-decoration: none;
  }

  .repo-link a:hover {
    text-decoration: underline;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
  }

  .close-btn {
    padding: 8px 24px;
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
  }

  .close-btn:hover {
    background: var(--accent);
    color: var(--accent-on);
  }
</style>

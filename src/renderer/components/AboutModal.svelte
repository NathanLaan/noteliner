<script>
  let { onClose } = $props();

  function focusOnMount(node) {
    node.focus();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' || e.key === 'Enter') onClose();
  }
</script>

<div class="modal-overlay" use:focusOnMount onclick={(e) => { if (e.target === e.currentTarget) onClose(); }} onkeydown={handleKeydown} role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal">
    <div class="modal-header">
      <h2>About</h2>
    </div>
    <div class="modal-body">
      <p class="app-name">NoteLiner</p>
      <p class="version">Version {__APP_VERSION__}</p>
      <p class="desc">An outliner-style note-taking application built with Electron and Svelte.</p>
      <div class="modal-footer">
        <button class="close-btn" onclick={onClose}>OK</button>
      </div>
    </div>
  </div>
</div>

<style>
  .app-name {
    font-size: 22px;
    font-weight: 400;
    color: var(--text-primary);
    margin-bottom: 6px;
  }

  .version {
    color: var(--text-muted);
    margin-bottom: 16px;
  }

  .desc {
    color: var(--text-secondary);
    margin-bottom: 24px;
    line-height: 1.5;
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

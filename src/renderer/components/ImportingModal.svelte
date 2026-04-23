<script>
  let { filename = '' } = $props();

  function focusOnMount(node) {
    node.focus();
  }
</script>

<div class="modal-overlay" use:focusOnMount role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal">
    <div class="modal-header">
      <h2>Importing</h2>
    </div>
    <div class="modal-body">
      <div class="importing-content">
        <i class="fas fa-file-import importing-icon"></i>
        <p class="importing-msg">
          {filename ? `Importing ${filename}...` : 'Importing document...'}
        </p>
      </div>
    </div>
  </div>
</div>

<style>
  .importing-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 40px 0;
  }

  .importing-icon {
    font-size: 32px;
    color: var(--accent);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .importing-msg {
    font-size: 14px;
    color: var(--text-secondary);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
</style>

<script>
  function focusOnMount(node) {
    node.focus();
  }
</script>

<div class="modal-overlay" use:focusOnMount role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal">
    <div class="modal-header">
      <h2>Syncing</h2>
    </div>
    <div class="modal-body">
      <div class="syncing-content">
        <i class="fas fa-cloud-arrow-up syncing-icon"></i>
        <p class="syncing-msg">Syncing changes to remote...</p>
      </div>
    </div>
  </div>
</div>

<style>
  .syncing-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 40px 0;
  }

  .syncing-icon {
    font-size: 32px;
    color: var(--accent);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .syncing-msg {
    font-size: 14px;
    color: var(--text-secondary);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
</style>

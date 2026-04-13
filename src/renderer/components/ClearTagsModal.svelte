<script>
  let { fileName, tagCount, onConfirm, onCancel } = $props();

  function focusOnMount(node) {
    node.focus();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter') onConfirm();
  }
</script>

<div class="modal-overlay" use:focusOnMount onclick={(e) => { if (e.target === e.currentTarget) onCancel(); }} onkeydown={handleKeydown} role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal">
    <div class="modal-header">
      <h2>Clear Tags</h2>
    </div>
    <div class="modal-body">
      <p class="prompt">Remove all {tagCount} tag{tagCount !== 1 ? 's' : ''} from <strong>{fileName}</strong>?</p>

      <div class="modal-footer">
        <button class="cancel-btn" onclick={onCancel}>Cancel</button>
        <button class="confirm-btn" onclick={onConfirm}>Clear Tags</button>
      </div>
    </div>
  </div>
</div>

<style>
  .prompt {
    color: var(--text-primary);
    font-size: 14px;
    margin-bottom: 24px;
    line-height: 1.5;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
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

  .confirm-btn {
    padding: 8px 24px;
    background: #e06060;
    color: #ffffff;
    border-radius: 6px;
    transition: background 0.15s;
  }

  .confirm-btn:hover {
    background: #c84040;
  }
</style>

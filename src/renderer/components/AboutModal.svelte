<script>
  import { onMount } from 'svelte';

  let { onClose } = $props();
  let version = $state('');

  onMount(async () => {
    version = await window.api.getVersion();
  });
</script>

<div class="modal-overlay" onclick={onClose} role="dialog" aria-modal="true">
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <h2>NoteLiner</h2>
    <p class="version">Version {version}</p>
    <p class="desc">An outliner-style note-taking application built with Electron and Svelte.</p>
    <button class="close-btn" onclick={onClose}>Close</button>
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
    padding: 32px;
    min-width: 320px;
    text-align: center;
  }

  h2 {
    font-size: 24px;
    font-weight: 400;
    color: var(--text-primary);
    margin-bottom: 8px;
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

  .close-btn {
    padding: 8px 24px;
    background: var(--bg-button);
    color: var(--text-primary);
    border-radius: 6px;
    transition: background 0.15s;
  }

  .close-btn:hover {
    background: var(--bg-button-hover);
  }
</style>

<script>
  import { themeState } from '../stores/theme.svelte.js';

  let { onClose } = $props();
</script>

<div class="modal-overlay" onclick={onClose} role="dialog" aria-modal="true">
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <h2>Settings</h2>

    <div class="setting-group">
      <label class="setting-label">Theme</label>
      <div class="theme-list">
        {#each themeState.list as theme (theme.id)}
          <button
            class="theme-option"
            class:active={themeState.current === theme.id}
            onclick={() => themeState.set(theme.id)}
          >
            <span class="theme-radio">
              {#if themeState.current === theme.id}
                <i class="fas fa-circle-check"></i>
              {:else}
                <i class="far fa-circle"></i>
              {/if}
            </span>
            {theme.name}
          </button>
        {/each}
      </div>
    </div>

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
    min-width: 340px;
  }

  h2 {
    font-size: 20px;
    font-weight: 400;
    color: var(--text-primary);
    margin-bottom: 24px;
  }

  .setting-group {
    margin-bottom: 24px;
  }

  .setting-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    display: block;
    margin-bottom: 10px;
  }

  .theme-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .theme-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--bg-button);
    color: var(--text-primary);
    border-radius: 6px;
    font-size: 14px;
    text-align: left;
    transition: background 0.15s;
  }

  .theme-option:hover {
    background: var(--bg-button-hover);
  }

  .theme-option.active {
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
  }

  .theme-radio {
    color: var(--text-muted);
    font-size: 15px;
    width: 18px;
    text-align: center;
  }

  .theme-option.active .theme-radio {
    color: var(--accent);
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

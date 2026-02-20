<script>
  import { logState } from '../stores/log.svelte.js';
  import { tick } from 'svelte';

  let logContainer;

  $effect(() => {
    // Auto-scroll to bottom when new entries arrive
    if (logState.entries.length && logContainer) {
      tick().then(() => {
        logContainer.scrollTop = logContainer.scrollHeight;
      });
    }
  });
</script>

<div class="log-wrapper">
  <div class="log-header">
    <span class="log-title">Sync Log</span>
    <button class="clear-btn" onclick={() => logState.clear()} title="Clear log">
      <i class="fas fa-trash-can"></i>
    </button>
  </div>
  <div class="log-content" bind:this={logContainer}>
    {#each logState.entries as entry}
      <div class="log-entry">
        <span class="log-time">{entry.timestamp}</span>
        <span class="log-msg">{entry.message}</span>
      </div>
    {/each}
    {#if logState.entries.length === 0}
      <div class="log-empty">No sync activity yet.</div>
    {/if}
  </div>
</div>

<style>
  .log-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-overlay);
  }

  .log-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: var(--bg-base);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .log-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .clear-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 11px;
    border-radius: 4px;
  }

  .clear-btn:hover {
    background: var(--bg-button);
    color: var(--text-primary);
  }

  .log-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    font-size: 12px;
  }

  .log-entry {
    display: flex;
    gap: 8px;
    padding: 2px 0;
  }

  .log-time {
    color: var(--text-faint);
    flex-shrink: 0;
  }

  .log-msg {
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-all;
  }

  .log-empty {
    color: var(--text-faint);
    font-style: italic;
  }
</style>

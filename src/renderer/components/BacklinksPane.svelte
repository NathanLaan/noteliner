<script>
  import { projectState } from '../stores/project.svelte.js';

  let { onSelect = () => {} } = $props();

  let entries = $state([]);
  let loading = $state(false);

  async function refresh() {
    const fileId = projectState.selectedFileId;
    if (!fileId) {
      entries = [];
      return;
    }
    loading = true;
    try {
      const result = await window.api.getBacklinks(fileId);
      entries = Array.isArray(result) ? result : [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    // Re-run when selection or the file set changes.
    projectState.selectedFileId;
    projectState.index.files.length;
    refresh();
  });

  function handleEntryClick(sourceId, line) {
    onSelect(sourceId, line);
  }
</script>

<div class="backlinks-pane">
  {#if !projectState.selectedFileId}
    <div class="empty-state">Select a note to see its backlinks.</div>
  {:else if loading && entries.length === 0}
    <div class="empty-state">Loading…</div>
  {:else if entries.length === 0}
    <div class="empty-state">No notes link here yet.</div>
  {:else}
    <ul class="backlinks-list">
      {#each entries as entry (entry.sourceId)}
        <li class="backlinks-item">
          <div class="source-name">{entry.sourceName}</div>
          {#each entry.matches as match}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="backlink-match" onclick={() => handleEntryClick(entry.sourceId, match.line)} title="Go to line {match.line}">
              <span class="line-num">L{match.line}</span>
              <span class="line-text">{match.text}</span>
            </div>
          {/each}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .backlinks-pane {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
    min-height: 0;
  }

  .empty-state {
    color: var(--text-muted);
    font-style: italic;
    font-size: 12px;
    padding: 12px;
  }

  .backlinks-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .backlinks-item {
    padding: 4px 0 8px 0;
  }

  .source-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    padding: 4px 12px 2px 12px;
  }

  .backlink-match {
    display: flex;
    gap: 8px;
    align-items: baseline;
    padding: 3px 12px 3px 24px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    border-left: 2px solid transparent;
  }

  .backlink-match:hover {
    background: var(--bg-item-hover);
    border-left-color: var(--accent);
  }

  .line-num {
    color: var(--text-muted);
    font-family: monospace;
    font-size: 11px;
    flex-shrink: 0;
  }

  .line-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }
</style>

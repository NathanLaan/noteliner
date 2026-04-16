<script>
  import { projectState } from '../stores/project.svelte.js';

  let { focusRequest = null } = $props();

  let query = $state('');
  let results = $state([]);
  let searching = $state(false);
  let debounceTimer = null;
  let inputEl;

  // Focus the input when the parent signals a focus request
  $effect(() => {
    if (focusRequest && inputEl) {
      inputEl.focus();
      inputEl.select();
    }
  });

  // Debounced search triggered on query change
  $effect(() => {
    const q = query.trim();
    if (debounceTimer) clearTimeout(debounceTimer);

    if (!q) {
      results = [];
      searching = false;
      return;
    }

    searching = true;
    debounceTimer = setTimeout(async () => {
      const r = await window.api.searchFiles(q);
      if (query.trim() === q) {
        results = r;
        searching = false;
      }
    }, 300);
  });

  async function navigateTo(fileId, line) {
    await projectState.selectFile(fileId);
    projectState.scrollToLine = { line, ts: Date.now() };
  }

  function totalMatches(res) {
    let count = 0;
    for (const r of res) count += r.matches.length;
    return count;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightMatch(text, q) {
    if (!q) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const escapedQ = escapeHtml(q);
    const regex = new RegExp(`(${escapeRegex(escapedQ)})`, 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  }
</script>

<div class="search-pane">
  <div class="search-input-container">
    <i class="fas fa-magnifying-glass search-icon"></i>
    <input
      bind:this={inputEl}
      type="text"
      class="search-input"
      placeholder="Search all files..."
      bind:value={query}
    />
  </div>

  {#if query.trim() && !searching && results.length > 0}
    <div class="search-summary">{totalMatches(results)} match{totalMatches(results) === 1 ? '' : 'es'} in {results.length} file{results.length === 1 ? '' : 's'}</div>
  {/if}

  <div class="search-results">
    {#if searching}
      <span class="search-status">Searching...</span>
    {:else if query.trim() && results.length === 0}
      <span class="search-status">No results</span>
    {:else}
      {#each results as group (group.fileId)}
        <div class="result-group">
          <div class="result-file">
            <i class="fas fa-file-lines result-file-icon"></i>
            <span class="result-file-name">{group.fileName}</span>
            <span class="result-count">{group.matches.length}</span>
          </div>
          {#each group.matches as match (match.line)}
            <button class="result-line" onclick={() => navigateTo(group.fileId, match.line)}>
              <span class="line-num">{match.line}</span>
              <span class="line-text">{@html highlightMatch(match.text, query.trim())}</span>
            </button>
          {/each}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .search-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .search-input-container {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    flex-shrink: 0;
  }

  .search-icon {
    font-size: 12px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    padding: 5px 8px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 12px;
    outline: none;
    min-width: 0;
  }

  .search-input:focus {
    border-color: var(--input-border-focus);
  }

  .search-summary {
    padding: 2px 8px 4px;
    font-size: 11px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .search-results {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .search-status {
    display: block;
    padding: 8px 12px;
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
  }

  .result-group {
    margin-bottom: 2px;
  }

  .result-file {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .result-file-icon {
    font-size: 11px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .result-file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .result-count {
    font-size: 10px;
    font-weight: 400;
    background: var(--tag-bg);
    color: var(--text-secondary);
    padding: 1px 6px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .result-line {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    padding: 3px 8px 3px 24px;
    font-size: 12px;
    color: var(--text-secondary);
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
  }

  .result-line:hover {
    background: var(--bg-item-hover);
    color: var(--text-primary);
  }

  .line-num {
    flex-shrink: 0;
    min-width: 28px;
    text-align: right;
    font-size: 10px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  .line-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .line-text :global(mark) {
    background: var(--accent);
    color: var(--accent-on);
    border-radius: 2px;
    padding: 0 1px;
  }
</style>

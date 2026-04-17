<script>
  import { projectState } from '../stores/project.svelte.js';
  import { marked } from 'marked';

  let { onClose = () => {} } = $props();

  let commits = $state([]);
  let selectedCommit = $state(null);
  let historicalContent = $state(null);
  let loading = $state(false);
  let commitListHeight = $state(200);

  function resolveAttachmentUrls(rawHtml) {
    return rawHtml.replace(
      /(?:src|href)="\.?\/?_attachments\/([^"]+)"/g,
      (match, filename) => match.replace(`./_attachments/${filename}`, `attachment:///${encodeURIComponent(filename)}`)
        .replace(`_attachments/${filename}`, `attachment:///${encodeURIComponent(filename)}`)
    );
  }

  function formatDate(dateStr) {
    try {
      const d = new Date(dateStr);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    } catch {
      return dateStr;
    }
  }

  async function loadHistory() {
    const file = projectState.selectedFile;
    if (!file) {
      commits = [];
      selectedCommit = null;
      historicalContent = null;
      return;
    }
    loading = true;
    try {
      commits = await window.api.getFileHistory(file.filename);
    } catch {
      commits = [];
    }
    selectedCommit = null;
    historicalContent = null;
    loading = false;
  }

  async function selectCommit(commit) {
    selectedCommit = commit.hash;
    const file = projectState.selectedFile;
    if (!file) return;
    loading = true;
    try {
      historicalContent = await window.api.getFileHistoryContent(commit.hash, file.filename);
    } catch {
      historicalContent = null;
    }
    loading = false;
  }

  // Reload history when file selection changes
  let currentFileId = null;
  $effect(() => {
    const fileId = projectState.selectedFileId;
    if (fileId !== currentFileId) {
      currentFileId = fileId;
      loadHistory();
    }
  });

  let previewHtml = $derived(
    historicalContent
      ? resolveAttachmentUrls(marked(historicalContent))
      : '<p class="empty">Select a commit to preview</p>'
  );

  function startResize(e) {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = commitListHeight;
    const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
    const onMouseMove = (ev) => {
      const deltaY = (ev.clientY - startY) / zoom;
      commitListHeight = Math.max(60, startHeight + deltaY);
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
</script>

<div class="history-wrapper">
  <div class="history-toolbar">
    <span class="history-title">HISTORY</span>
    <button class="close-btn" onclick={onClose} title="Close History">
      <i class="fas fa-xmark"></i>
    </button>
  </div>

  <div class="commit-list" style="height: {commitListHeight}px">
    {#if loading && commits.length === 0}
      <p class="history-msg">Loading...</p>
    {:else if commits.length === 0}
      <p class="history-msg">No history</p>
    {:else}
      {#each commits as commit (commit.hash)}
        <div
          class="commit-item"
          class:selected={commit.hash === selectedCommit}
          onclick={() => selectCommit(commit)}
          role="button"
          tabindex="0"
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCommit(commit); } }}
        >
          <div class="commit-header">
            <span class="commit-date">{formatDate(commit.date)}</span>
            <span class="commit-author">{commit.author}</span>
          </div>
          <div class="commit-message">{commit.message}</div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="history-resizer" role="separator" aria-orientation="horizontal" tabindex="-1" onmousedown={startResize}></div>

  <div class="history-preview">
    {#if loading && selectedCommit}
      <p class="history-msg">Loading...</p>
    {:else}
      {@html previewHtml}
    {/if}
  </div>
</div>

<style>
  .history-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-surface);
  }

  .history-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    min-height: 44px;
    box-sizing: border-box;
    background: var(--bg-base);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .history-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .close-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 12px;
  }

  .close-btn:hover {
    background: var(--bg-button);
    color: var(--text-primary);
  }

  .commit-list {
    overflow-y: auto;
    flex-shrink: 0;
  }

  .commit-item {
    padding: 8px 12px;
    cursor: pointer;
    border-left: 2px solid transparent;
    transition: background 0.1s;
  }

  .commit-item:hover {
    background: var(--bg-item-hover);
  }

  .commit-item.selected {
    background: var(--bg-selected);
    border-left-color: var(--accent);
  }

  .commit-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
  }

  .commit-date {
    font-size: 11px;
    color: var(--text-muted);
    font-family: monospace;
    flex-shrink: 0;
  }

  .commit-author {
    font-size: 11px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .commit-message {
    font-size: 12px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .history-resizer {
    height: 4px;
    cursor: row-resize;
    background: var(--border);
    flex-shrink: 0;
  }

  .history-resizer:hover {
    background: var(--border-hover);
  }

  .history-preview {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
    line-height: 1.6;
    min-height: 0;
  }

  .history-msg {
    color: var(--text-muted);
    font-style: italic;
    font-size: 13px;
    padding: 8px;
  }

  .history-preview :global(h1) { font-size: 24px; margin-bottom: 12px; color: var(--text-primary); }
  .history-preview :global(h2) { font-size: 20px; margin-bottom: 10px; color: var(--text-primary); }
  .history-preview :global(h3) { font-size: 17px; margin-bottom: 8px; color: var(--text-primary); }
  .history-preview :global(p) { margin-bottom: 12px; color: var(--text-tertiary); }
  .history-preview :global(a) { color: var(--accent); }
  .history-preview :global(code) { background: var(--code-bg); padding: 2px 6px; border-radius: 4px; font-size: 13px; }
  .history-preview :global(pre) { background: var(--pre-bg); padding: 12px; border-radius: 6px; overflow-x: auto; margin-bottom: 12px; }
  .history-preview :global(pre code) { background: none; padding: 0; }
  .history-preview :global(blockquote) { border-left: 3px solid var(--blockquote-border); padding-left: 12px; color: var(--text-secondary); margin-bottom: 12px; }
  .history-preview :global(ul), .history-preview :global(ol) { padding-left: 24px; margin-bottom: 12px; }
  .history-preview :global(li) { margin-bottom: 4px; }
  .history-preview :global(img) { max-width: 100%; height: auto; border-radius: 4px; }
  .history-preview :global(.empty) { color: var(--text-muted); font-style: italic; }
</style>

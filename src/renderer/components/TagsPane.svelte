<script>
  import { projectState } from '../stores/project.svelte.js';

  let { onTagsChanged, tagAction = null } = $props();

  let selectedTag = $state(null);
  let adding = $state(false);
  let addValue = $state('');

  function autoFocus(node) {
    node.focus();
  }

  function handleAdd() {
    if (!projectState.selectedFileId) return;
    adding = true;
    addValue = '';
  }

  function commitAdd() {
    const value = addValue.trim();
    if (value && projectState.selectedFileId) {
      projectState.addTag(projectState.selectedFileId, value);
      onTagsChanged();
    }
    adding = false;
    addValue = '';
  }

  function cancelAdd() {
    adding = false;
    addValue = '';
  }

  function handleInputKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitAdd();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelAdd();
    }
  }

  function handleRemove() {
    if (!projectState.selectedFileId) return;
    const tags = projectState.selectedFileTags;
    if (tags.length === 0) return;

    const tagToRemove = selectedTag && tags.includes(selectedTag) ? selectedTag : tags[tags.length - 1];
    projectState.removeTag(projectState.selectedFileId, tagToRemove);
    selectedTag = null;
    onTagsChanged();
  }

  $effect(() => {
    if (tagAction) {
      if (tagAction.type === 'add') handleAdd();
      else if (tagAction.type === 'remove') handleRemove();
    }
  });

  // Clear selected tag when file selection changes
  $effect(() => {
    projectState.selectedFileId;
    selectedTag = null;
    adding = false;
  });

  let dragOverTag = $state(null);

  function handleChipDragOver(e, tag) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverTag = tag;
  }

  function handleChipDragLeave() {
    dragOverTag = null;
  }

  function handleChipDrop(e, tag) {
    e.preventDefault();
    dragOverTag = null;
    const fileId = e.dataTransfer.getData('text/plain');
    if (!fileId) return;
    projectState.addTag(fileId, tag);
    onTagsChanged();
  }

  let hasSelection = $derived(!!projectState.selectedFileId);
  let tags = $derived(projectState.selectedFileTags);
</script>

<div class="tags-pane">
  <div class="tags-header">
    <span class="tags-title">TAGS</span>
    <div class="tags-actions">
      <button class="tags-btn" onclick={handleAdd} disabled={!hasSelection} title="Add Tag (Ctrl+T)">
        <i class="fas fa-plus"></i>
      </button>
      <button class="tags-btn" onclick={handleRemove} disabled={!hasSelection || tags.length === 0} title="Remove Tag (Ctrl+Y)">
        <i class="fas fa-minus"></i>
      </button>
    </div>
  </div>
  <div class="tags-body">
    {#if adding}
      <input
        class="tag-input"
        type="text"
        bind:value={addValue}
        placeholder="Tag name..."
        onkeydown={handleInputKeydown}
        onblur={cancelAdd}
        use:autoFocus
      />
    {/if}
    {#each tags as tag (tag)}
      <button
        class="tag-chip"
        class:selected={tag === selectedTag}
        class:drag-over={tag === dragOverTag}
        onclick={() => selectedTag = (selectedTag === tag ? null : tag)}
        ondragover={(e) => handleChipDragOver(e, tag)}
        ondragleave={handleChipDragLeave}
        ondrop={(e) => handleChipDrop(e, tag)}
      >
        {tag}
      </button>
    {/each}
    {#if !adding && tags.length === 0 && hasSelection}
      <span class="tags-empty">No tags</span>
    {/if}
  </div>
</div>

<style>
  .tags-pane {
    flex-shrink: 0;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
  }

  .tags-header {
    padding: 6px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-base);
    flex-shrink: 0;
  }

  .tags-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .tags-actions {
    display: flex;
    gap: 2px;
  }

  .tags-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 11px;
    transition: background 0.15s, color 0.15s;
  }

  .tags-btn:hover:not(:disabled) {
    background: var(--bg-button-hover);
    color: var(--text-primary);
  }

  .tags-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .tags-body {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 8px 12px;
    min-height: 36px;
    max-height: 80px;
    overflow-y: auto;
    align-content: flex-start;
  }

  .tag-input {
    background: var(--input-bg);
    border: 1px solid var(--accent);
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 12px;
    color: var(--text-primary);
    outline: none;
    width: 100px;
    height: 24px;
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    font-size: 12px;
    background: var(--bg-button);
    color: var(--text-secondary);
    border-radius: 10px;
    transition: background 0.15s, color 0.15s;
    height: 24px;
  }

  .tag-chip:hover {
    background: var(--bg-button-hover);
    color: var(--text-primary);
  }

  .tag-chip.selected {
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
  }

  .tag-chip.drag-over {
    background: var(--bg-selected);
    outline: 2px solid var(--accent);
    color: var(--accent);
  }

  .tags-empty {
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
  }
</style>

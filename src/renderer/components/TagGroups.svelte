<script>
  import { projectState } from '../stores/project.svelte.js';

  let { selectedId, onSelect } = $props();

  let expandedTags = $state(new Set());

  function toggle(tag) {
    if (expandedTags.has(tag)) {
      expandedTags.delete(tag);
    } else {
      expandedTags.add(tag);
    }
    expandedTags = new Set(expandedTags);
  }

  function isExpanded(tag) {
    return expandedTags.has(tag);
  }
</script>

{#each projectState.allTags as tag (tag)}
  {@const files = projectState.getFilesWithTag(tag)}
  {@const expanded = isExpanded(tag)}
  <div class="tag-header" onclick={() => toggle(tag)} role="treeitem" aria-selected="false" aria-expanded={expanded} tabindex="0" onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(tag); } }}>
    <i class="fas fa-chevron-right chevron" class:expanded></i>
    <i class="fas fa-tag tag-icon"></i>
    <span class="tag-name">{tag}</span>
    <span class="tag-file-count">{files.length}</span>
  </div>
  {#if expanded}
    {#each files as file (file.id)}
      <div
        class="tag-file-item"
        class:selected={file.id === selectedId}
        onclick={() => onSelect(file.id)}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(file.id); } }}
        role="treeitem"
        aria-selected={file.id === selectedId}
        tabindex="0"
      >
        <i class="fas fa-file-lines file-icon"></i>
        <span class="file-name">{file.name}</span>
      </div>
    {/each}
  {/if}
{/each}

<style>
  .tag-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    cursor: pointer;
    user-select: none;
    transition: background 0.1s;
  }

  .tag-header:hover {
    background: var(--bg-item-hover);
  }

  .chevron {
    font-size: 10px;
    color: var(--text-muted);
    transition: transform 0.15s;
    width: 12px;
    text-align: center;
    flex-shrink: 0;
  }

  .chevron.expanded {
    transform: rotate(90deg);
  }

  .tag-icon {
    font-size: 12px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .tag-name {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tag-file-count {
    font-size: 10px;
    background: var(--tag-bg);
    color: var(--text-secondary);
    padding: 1px 6px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .tag-file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 12px 5px 36px;
    cursor: pointer;
    user-select: none;
    border-left: 2px solid transparent;
    transition: background 0.1s;
  }

  .tag-file-item:hover {
    background: var(--bg-item-hover);
  }

  .tag-file-item.selected {
    background: var(--bg-selected);
    border-left-color: var(--accent);
  }

  .file-icon {
    font-size: 13px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }
</style>

<script>
  import { projectState } from '../stores/project.svelte.js';
  import FileTree from './FileTree.svelte';

  let {
    parentId,
    selectedId,
    editingId,
    editingName,
    onSelect,
    onStartRename,
    onCommitRename,
    onDelete,
    onDrop,
    onEditingNameChange,
    depth = 0
  } = $props();

  let dragOverId = $state(null);
  let dragOverPosition = $state(null);

  function getChildren() {
    return projectState.getChildren(parentId);
  }

  function handleDragStart(e, fileId) {
    e.dataTransfer.setData('text/plain', fileId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e, fileId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    if (y < height * 0.25) {
      dragOverPosition = 'before';
    } else if (y > height * 0.75) {
      dragOverPosition = 'after';
    } else {
      dragOverPosition = 'child';
    }
    dragOverId = fileId;
  }

  function handleDragLeave() {
    dragOverId = null;
    dragOverPosition = null;
  }

  function handleDropEvent(e, targetId) {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && draggedId !== targetId) {
      onDrop(draggedId, targetId, dragOverPosition || 'after');
    }
    dragOverId = null;
    dragOverPosition = null;
  }

  function autoFocus(node) {
    node.focus();
  }

  function handleKeydown(e, fileId) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(fileId);
    }
  }

  function handleContextMenu(e, file) {
    e.preventDefault();
    const action = prompt(`File: ${file.name}\n\nType "rename" to rename, "delete" to delete:`);
    if (action === 'rename') {
      onStartRename(file.id, file.name);
    } else if (action === 'delete') {
      if (confirm(`Delete "${file.name}"?`)) {
        onDelete(file.id);
      }
    }
  }
</script>

{#each getChildren() as file (file.id)}
  {@const isSelected = file.id === selectedId}
  {@const isDragOver = file.id === dragOverId}
  <div
    class="file-item"
    class:selected={isSelected}
    class:drag-over-before={isDragOver && dragOverPosition === 'before'}
    class:drag-over-after={isDragOver && dragOverPosition === 'after'}
    class:drag-over-child={isDragOver && dragOverPosition === 'child'}
    style="padding-left: {12 + depth * 16}px"
    draggable="true"
    ondragstart={(e) => handleDragStart(e, file.id)}
    ondragover={(e) => handleDragOver(e, file.id)}
    ondragleave={handleDragLeave}
    ondrop={(e) => handleDropEvent(e, file.id)}
    onclick={() => onSelect(file.id)}
    onkeydown={(e) => handleKeydown(e, file.id)}
    ondblclick={() => onStartRename(file.id, file.name)}
    oncontextmenu={(e) => handleContextMenu(e, file)}
    role="treeitem"
    aria-selected={isSelected}
    tabindex="0"
  >
    {#if file.id === editingId}
      <input
        class="rename-input"
        type="text"
        value={editingName}
        oninput={(e) => onEditingNameChange(e.target.value)}
        onblur={onCommitRename}
        onkeydown={(e) => { if (e.key === 'Enter') onCommitRename(); if (e.key === 'Escape') { onEditingNameChange(''); onCommitRename(); } }}
        use:autoFocus
      />
    {:else}
      <i class="fas fa-file-lines file-icon"></i>
      <span class="file-name">{file.name}</span>
      {#if file.tags && file.tags.length > 0}
        <span class="tag-count">{file.tags.length}</span>
      {/if}
    {/if}
  </div>

  <FileTree
    parentId={file.id}
    {selectedId}
    {editingId}
    {editingName}
    {onSelect}
    {onStartRename}
    {onCommitRename}
    {onDelete}
    {onDrop}
    {onEditingNameChange}
    depth={depth + 1}
  />
{/each}

<style>
  .file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    cursor: pointer;
    user-select: none;
    border-left: 2px solid transparent;
    transition: background 0.1s;
  }

  .file-item:hover {
    background: var(--bg-item-hover);
  }

  .file-item.selected {
    background: var(--bg-selected);
    border-left-color: var(--accent);
  }

  .file-item.drag-over-before {
    border-top: 2px solid var(--accent);
  }

  .file-item.drag-over-after {
    border-bottom: 2px solid var(--accent);
  }

  .file-item.drag-over-child {
    background: var(--bg-drag-over);
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

  .tag-count {
    font-size: 10px;
    background: var(--tag-bg);
    color: var(--text-secondary);
    padding: 1px 6px;
    border-radius: 8px;
  }

  .rename-input {
    flex: 1;
    background: var(--input-bg);
    border: 1px solid var(--accent);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 13px;
    outline: none;
  }
</style>

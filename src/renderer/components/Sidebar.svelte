<script>
  import { onMount, tick } from 'svelte';
  import { projectState } from '../stores/project.svelte.js';
  import FileTree from './FileTree.svelte';
  import TagGroupsPane from './TagGroupsPane.svelte';
  import TagsPane from './TagsPane.svelte';
  import OutlinePane from './OutlinePane.svelte';

  let { tagAction = null, outlineVisible = false, tagGroupsVisible = false } = $props();

  let editingId = $state(null);
  let editingName = $state('');

  // Resizable pane heights (pixels, 0 = use flex default)
  let tagGroupsHeight = $state(150);
  let outlineHeight = $state(150);
  let tagsHeight = $state(100);

  function startRename(fileId, currentName) {
    editingId = fileId;
    editingName = currentName;
  }

  async function commitRename() {
    if (!editingId) return;
    const newName = editingName.trim();
    if (newName) {
      const entry = await window.api.renameFile(editingId, newName);
      if (entry) {
        projectState.updateFile(editingId, { name: entry.name, filename: entry.filename });
      }
    }
    editingId = null;
    editingName = '';
  }

  async function handleDelete(fileId) {
    await window.api.deleteFile(fileId);
    projectState.removeFile(fileId);
  }

  function handleSelect(fileId) {
    projectState.selectFile(fileId);
  }

  async function handleTagsChanged() {
    await window.api.saveIndex($state.snapshot(projectState.index));
  }

  let externalDragOver = $state(false);

  function handleExternalDragOver(e) {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      externalDragOver = true;
    }
  }

  function handleExternalDragLeave(e) {
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget)) {
      externalDragOver = false;
    }
  }

  async function handleExternalDrop(e) {
    externalDragOver = false;
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const mdFiles = [...files].filter(f => f.name.toLowerCase().endsWith('.md'));
    if (mdFiles.length === 0) return;

    e.preventDefault();
    e.stopPropagation();

    for (const file of mdFiles) {
      const displayName = file.name.replace(/\.md$/i, '');
      const content = await file.text();
      const entry = await window.api.createFile(displayName);
      projectState.addFile(entry);
      await window.api.writeFile(entry.filename, content);
      projectState.selectFile(entry.id);
    }
  }

  async function handleDrop(draggedId, targetId, position) {
    const files = projectState.index.files;
    const dragged = files.find(f => f.id === draggedId);
    const target = files.find(f => f.id === targetId);
    if (!dragged || !target) return;

    if (position === 'child') {
      dragged.parentId = target.id;
      const children = projectState.getChildren(target.id);
      dragged.order = children.length;
    } else {
      dragged.parentId = target.parentId;
      const siblings = projectState.getChildren(target.parentId).filter(f => f.id !== draggedId);
      const targetIndex = siblings.findIndex(f => f.id === targetId);
      const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
      siblings.splice(insertIndex, 0, dragged);
      siblings.forEach((f, i) => f.order = i);
    }

    await window.api.saveIndex($state.snapshot(projectState.index));
  }

  function startResize(getter, setter, minH) {
    return (e) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = getter();
      const onMouseMove = (e) => {
        setter(Math.max(minH, startHeight - (e.clientY - startY)));
      };
      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="sidebar-content" class:drop-target={externalDragOver} ondragover={handleExternalDragOver} ondragleave={handleExternalDragLeave} ondrop={handleExternalDrop}>
  <div class="sidebar-header">
    <span class="sidebar-title">FILES</span>
  </div>
  <div class="file-list">
    <FileTree
      parentId={null}
      selectedId={projectState.selectedFileId}
      {editingId}
      {editingName}
      onSelect={handleSelect}
      onStartRename={startRename}
      onCommitRename={commitRename}
      onDelete={handleDelete}
      onDrop={handleDrop}
      onEditingNameChange={(val) => editingName = val}
    />
  </div>

  {#if tagGroupsVisible}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="pane-resizer" role="separator" aria-orientation="horizontal" tabindex="-1" onmousedown={startResize(() => tagGroupsHeight, (v) => tagGroupsHeight = v, 60)}></div>
    <div class="resizable-pane" style="height: {tagGroupsHeight}px">
      <TagGroupsPane selectedId={projectState.selectedFileId} onSelect={handleSelect} onTagsChanged={handleTagsChanged} />
    </div>
  {/if}

  {#if outlineVisible}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="pane-resizer" role="separator" aria-orientation="horizontal" tabindex="-1" onmousedown={startResize(() => outlineHeight, (v) => outlineHeight = v, 60)}></div>
    <div class="resizable-pane" style="height: {outlineHeight}px">
      <OutlinePane />
    </div>
  {/if}

  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="pane-resizer" role="separator" aria-orientation="horizontal" tabindex="-1" onmousedown={startResize(() => tagsHeight, (v) => tagsHeight = v, 50)}></div>
  <div class="resizable-pane" style="height: {tagsHeight}px">
    <TagsPane onTagsChanged={handleTagsChanged} {tagAction} />
  </div>
</div>

<style>
  .sidebar-content {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .sidebar-header {
    padding: 8px 12px;
    min-height: 44px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-base);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .sidebar-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .file-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
    min-height: 80px;
  }

  .resizable-pane {
    flex-shrink: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .pane-resizer {
    height: 4px;
    cursor: row-resize;
    background: var(--border);
    flex-shrink: 0;
  }

  .pane-resizer:hover {
    background: var(--border-hover);
  }

  .sidebar-content.drop-target {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
    background: var(--bg-drag-over);
  }
</style>

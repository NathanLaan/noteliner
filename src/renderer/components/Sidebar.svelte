<script>
  import { projectState } from '../stores/project.svelte.js';
  import FileTree from './FileTree.svelte';
  import TagGroupsPane from './TagGroupsPane.svelte';
  import TagsPane from './TagsPane.svelte';
  import OutlinePane from './OutlinePane.svelte';

  let {
    tagAction = null,
    outlineVisible = false,
    tagGroupsVisible = false,
    filesHeight = 200,
    tagGroupsHeight = 150,
    outlineHeight = 150,
    tagsHeight = 100,
    paneOrder = ['files', 'tagGroups', 'outline', 'tags'],
    onPaneResize,
    onPaneReorder,
    onContextAction,
  } = $props();

  let editingId = $state(null);
  let editingName = $state('');

  // Pane definitions — title and height key per pane
  const PANE_META = {
    files: { title: 'FILES', heightKey: 'filesHeight', minH: 80 },
    tagGroups: { title: 'TAG GROUPS', heightKey: 'tagGroupsHeight', minH: 60 },
    outline: { title: 'OUTLINE', heightKey: 'outlineHeight', minH: 60 },
    tags: { title: 'TAGS', heightKey: 'tagsHeight', minH: 50 },
  };

  function isPaneVisible(key) {
    if (key === 'files' || key === 'tags') return true;
    if (key === 'tagGroups') return tagGroupsVisible;
    if (key === 'outline') return outlineVisible;
    return false;
  }

  function getHeightForPane(key) {
    switch (key) {
      case 'files': return filesHeight;
      case 'tagGroups': return tagGroupsHeight;
      case 'outline': return outlineHeight;
      case 'tags': return tagsHeight;
      default: return 100;
    }
  }

  let visiblePanes = $derived(paneOrder.filter(isPaneVisible));

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

  // Pane resizing — the resizer adjusts the pane ABOVE it (which has a fixed
  // height). The last pane is flex and absorbs the freed/taken space.
  function startResize(paneKeyAbove) {
    return (e) => {
      e.preventDefault();
      const meta = PANE_META[paneKeyAbove];
      const startY = e.clientY;
      const startHeight = getHeightForPane(paneKeyAbove);
      // Mouse coords are in viewport pixels, but panes live inside the zoomed
      // .app-layout (zoom: var(--ui-zoom)). Divide delta by zoom so pane
      // height tracks the cursor at any UI scale.
      const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
      const onMouseMove = (ev) => {
        const deltaY = (ev.clientY - startY) / zoom;
        const newHeight = Math.max(meta.minH, startHeight + deltaY);
        if (onPaneResize) onPaneResize(meta.heightKey, newHeight);
      };
      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };
  }

  // Pane reorder via drag-and-drop on headers
  const PANE_MIME = 'application/x-noteliner-pane';
  let draggingPane = $state(null);
  let dragOverPane = $state(null);
  let dragOverPosition = $state(null); // 'before' | 'after'

  function handleHeaderDragStart(e, paneKey) {
    e.dataTransfer.setData(PANE_MIME, paneKey);
    e.dataTransfer.effectAllowed = 'move';
    draggingPane = paneKey;
  }

  function handleHeaderDragEnd() {
    draggingPane = null;
    dragOverPane = null;
    dragOverPosition = null;
  }

  function handleHeaderDragOver(e, paneKey) {
    if (!e.dataTransfer.types.includes(PANE_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    dragOverPosition = y < rect.height / 2 ? 'before' : 'after';
    dragOverPane = paneKey;
  }

  function handleHeaderDragLeave() {
    dragOverPane = null;
  }

  function handleHeaderDrop(e, targetKey) {
    if (!e.dataTransfer.types.includes(PANE_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    const draggedKey = e.dataTransfer.getData(PANE_MIME);
    const position = dragOverPosition;
    dragOverPane = null;
    dragOverPosition = null;
    draggingPane = null;
    if (!draggedKey || draggedKey === targetKey) return;

    const newOrder = paneOrder.filter(k => k !== draggedKey);
    const targetIndex = newOrder.indexOf(targetKey);
    if (targetIndex === -1) return;
    const insertAt = position === 'before' ? targetIndex : targetIndex + 1;
    newOrder.splice(insertAt, 0, draggedKey);

    if (onPaneReorder) onPaneReorder(newOrder);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="sidebar-content" class:drop-target={externalDragOver} ondragover={handleExternalDragOver} ondragleave={handleExternalDragLeave} ondrop={handleExternalDrop}>
  {#each visiblePanes as paneKey, i (paneKey)}
    {@const isLast = i === visiblePanes.length - 1}
    {#if i > 0}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div class="pane-resizer" role="separator" aria-orientation="horizontal" tabindex="-1" onmousedown={startResize(visiblePanes[i - 1])}></div>
    {/if}
    <div
      class="resizable-pane"
      class:flex-pane={isLast}
      style={isLast ? '' : `height: ${getHeightForPane(paneKey)}px`}
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="pane-header"
        class:dragging={draggingPane === paneKey}
        class:drag-over-before={dragOverPane === paneKey && dragOverPosition === 'before'}
        class:drag-over-after={dragOverPane === paneKey && dragOverPosition === 'after'}
        draggable="true"
        ondragstart={(e) => handleHeaderDragStart(e, paneKey)}
        ondragend={handleHeaderDragEnd}
        ondragover={(e) => handleHeaderDragOver(e, paneKey)}
        ondragleave={handleHeaderDragLeave}
        ondrop={(e) => handleHeaderDrop(e, paneKey)}
      >
        <span class="pane-title">{PANE_META[paneKey].title}</span>
      </div>

      <div class="pane-body">
        {#if paneKey === 'files'}
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
            {onContextAction}
          />
        {:else if paneKey === 'tagGroups'}
          <TagGroupsPane selectedId={projectState.selectedFileId} onSelect={handleSelect} onTagsChanged={handleTagsChanged} />
        {:else if paneKey === 'outline'}
          <OutlinePane />
        {:else if paneKey === 'tags'}
          <TagsPane onTagsChanged={handleTagsChanged} {tagAction} />
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .sidebar-content {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .resizable-pane {
    flex-shrink: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .resizable-pane.flex-pane {
    flex: 1;
    min-height: 100px;
  }

  .pane-body {
    flex: 1;
    min-height: 0;
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

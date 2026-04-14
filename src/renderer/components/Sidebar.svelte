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
    tagsVisible = true,
    filesHeight = 200,
    tagGroupsHeight = 150,
    outlineHeight = 150,
    tagsHeight = 100,
    paneOrder = ['files', 'tagGroups', 'outline', 'tags'],
    onPaneResize,
    onPaneReorder,
    onContextAction,
    onTagAction,
  } = $props();

  let editingId = $state(null);
  let editingName = $state('');

  // Header height (matches .pane-header in global.css)
  const HEADER_H = 44;
  const RESIZER_H = 4;

  // Pane definitions — title and height key per pane
  const PANE_META = {
    files: { title: 'FILES', heightKey: 'filesHeight', minH: HEADER_H },
    tagGroups: { title: 'TAG GROUPS', heightKey: 'tagGroupsHeight', minH: HEADER_H },
    outline: { title: 'OUTLINE', heightKey: 'outlineHeight', minH: HEADER_H },
    tags: { title: 'TAGS', heightKey: 'tagsHeight', minH: HEADER_H },
  };

  let sidebarEl;

  function isPaneVisible(key) {
    if (key === 'files') return true;
    if (key === 'tags') return tagsVisible;
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

  // Clamp pane heights whenever the available space or pane set changes so
  // the total doesn't exceed the sidebar height (e.g., after window resize).
  function clampHeights() {
    if (!sidebarEl || !onPaneResize) return;
    const totalH = sidebarEl.clientHeight;
    if (totalH <= 0) return;
    const resizerCount = Math.max(0, visiblePanes.length - 1);
    const budget = totalH - resizerCount * RESIZER_H;
    let sum = 0;
    for (const key of visiblePanes) sum += getHeightForPane(key);
    if (sum > budget && sum > 0) {
      const scale = budget / sum;
      for (const key of visiblePanes) {
        const meta = PANE_META[key];
        const scaled = Math.max(meta.minH, Math.floor(getHeightForPane(key) * scale));
        onPaneResize(meta.heightKey, scaled);
      }
    }
  }

  $effect(() => {
    // Track visible pane set and sizes
    visiblePanes;
    clampHeights();
  });

  $effect(() => {
    if (!sidebarEl) return;
    const ro = new ResizeObserver(() => clampHeights());
    ro.observe(sidebarEl);
    return () => ro.disconnect();
  });

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

  // Pane resizing — when the pane below the divider is the last (flex) pane,
  // only the pane above is resized and the flex pane absorbs the change.
  // Otherwise, both the pane above and below the divider resize inversely,
  // keeping all other panes (including the flex pane) unchanged.
  function startResize(paneKeyAbove, paneKeyBelow, isBelowLast) {
    return (e) => {
      e.preventDefault();
      const metaAbove = PANE_META[paneKeyAbove];
      const startY = e.clientY;
      const startHeightAbove = getHeightForPane(paneKeyAbove);
      // Mouse coords are in viewport pixels, but panes live inside the zoomed
      // .app-layout (zoom: var(--ui-zoom)). Divide delta by zoom so pane
      // height tracks the cursor at any UI scale.
      const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;

      if (!isBelowLast) {
        // Resize both panes on either side of the divider inversely.
        const metaBelow = PANE_META[paneKeyBelow];
        const startHeightBelow = getHeightForPane(paneKeyBelow);
        const combinedHeight = startHeightAbove + startHeightBelow;

        const onMouseMove = (ev) => {
          const deltaY = (ev.clientY - startY) / zoom;
          let newAbove = startHeightAbove + deltaY;
          let newBelow = startHeightBelow - deltaY;

          // Clamp to minimums, giving the remainder to the other pane.
          if (newAbove < metaAbove.minH) {
            newAbove = metaAbove.minH;
            newBelow = combinedHeight - newAbove;
          } else if (newBelow < metaBelow.minH) {
            newBelow = metaBelow.minH;
            newAbove = combinedHeight - newBelow;
          }

          if (onPaneResize) {
            onPaneResize(metaAbove.heightKey, newAbove);
            onPaneResize(metaBelow.heightKey, newBelow);
          }
        };
        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      } else {
        // Last pane is flex — only resize the pane above.
        const totalH = sidebarEl ? sidebarEl.clientHeight : 0;
        const resizerCount = Math.max(0, visiblePanes.length - 1);
        let reservedForOthers = resizerCount * RESIZER_H;
        for (const key of visiblePanes) {
          if (key !== paneKeyAbove) reservedForOthers += getHeightForPane(key);
        }
        const maxH = Math.max(metaAbove.minH, totalH - reservedForOthers);

        const onMouseMove = (ev) => {
          const deltaY = (ev.clientY - startY) / zoom;
          const newHeight = Math.min(maxH, Math.max(metaAbove.minH, startHeightAbove + deltaY));
          if (onPaneResize) onPaneResize(metaAbove.heightKey, newHeight);
        };
        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      }
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
<div class="sidebar-content" bind:this={sidebarEl} class:drop-target={externalDragOver} ondragover={handleExternalDragOver} ondragleave={handleExternalDragLeave} ondrop={handleExternalDrop}>
  {#each visiblePanes as paneKey, i (paneKey)}
    {@const isLast = i === visiblePanes.length - 1}
    {#if i > 0}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div class="pane-resizer" role="separator" aria-orientation="horizontal" tabindex="-1" onmousedown={startResize(visiblePanes[i - 1], paneKey, isLast)}></div>
    {/if}
    <div
      class="resizable-pane"
      class:flex-pane={isLast}
      style="height: {getHeightForPane(paneKey)}px"
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
        {#if paneKey === 'tags'}
          <div class="pane-header-actions" draggable="false" ondragstart={(e) => e.preventDefault()}>
            <button class="pane-header-btn" onclick={() => onTagAction?.('add')} disabled={!projectState.selectedFileId} title="Add Tag (Ctrl+T)">
              <i class="fas fa-plus"></i>
            </button>
            <button class="pane-header-btn" onclick={() => onTagAction?.('remove')} disabled={!projectState.selectedFileId || projectState.selectedFileTags.length === 0} title="Remove Tag (Ctrl+Y)">
              <i class="fas fa-minus"></i>
            </button>
          </div>
        {/if}
      </div>

      <div class="pane-body">
        {#if paneKey === 'files'}
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
              {onContextAction}
            />
          </div>
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
    overflow: hidden;
  }

  .resizable-pane {
    flex-shrink: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 44px;
  }

  /* Last visible pane auto-grows to fill leftover space when the sum of
     pane heights is less than the sidebar. If user-assigned heights fill
     the sidebar, the explicit height wins and flex-grow is inactive. */
  .resizable-pane.flex-pane {
    flex-grow: 1;
  }

  .pane-body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .file-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
    min-height: 0;
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

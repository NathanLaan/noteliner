<script>
  import { onMount, tick } from 'svelte';
  import { projectState } from '../stores/project.svelte.js';
  import FileTree from './FileTree.svelte';

  let editingId = $state(null);
  let editingName = $state('');

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

  async function handleDrop(draggedId, targetId, position) {
    // position: 'before', 'after', 'child'
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

    await window.api.saveIndex(projectState.index);
  }
</script>

<div class="sidebar-content">
  <div class="sidebar-header">
    <span class="sidebar-title">Files</span>
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
</div>

<style>
  .sidebar-content {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .sidebar-header {
    padding: 12px 16px 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sidebar-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .file-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }
</style>

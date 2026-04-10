<script>
  import { projectState } from '../stores/project.svelte.js';
  import { logState } from '../stores/log.svelte.js';

  const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
  const MAX_SIZE = 30 * 1024 * 1024;

  const FILE_ICONS = {
    '.pdf': 'fa-file-pdf',
    '.doc': 'fa-file-word', '.docx': 'fa-file-word',
    '.xls': 'fa-file-excel', '.xlsx': 'fa-file-excel',
    '.csv': 'fa-file-csv',
    '.zip': 'fa-file-zipper', '.rar': 'fa-file-zipper', '.gz': 'fa-file-zipper',
    '.mp3': 'fa-file-audio', '.wav': 'fa-file-audio',
    '.mp4': 'fa-file-video', '.mov': 'fa-file-video',
    '.txt': 'fa-file-lines',
    '.json': 'fa-file-code', '.js': 'fa-file-code', '.html': 'fa-file-code',
  };

  function getExtension(name) {
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot).toLowerCase() : '';
  }

  function isImage(name) {
    return IMAGE_EXTENSIONS.includes(getExtension(name));
  }

  function getFileIcon(name) {
    const ext = getExtension(name);
    return FILE_ICONS[ext] || 'fa-file';
  }

  function getFileType(name) {
    const ext = getExtension(name);
    return ext ? ext.slice(1).toUpperCase() : 'FILE';
  }

  function getThumbnailUrl(attachment) {
    return `attachment:///${encodeURIComponent(attachment.filename)}`;
  }

  async function handleAddFiles() {
    if (!projectState.selectedFileId) return;
    const files = await window.api.openFileDialog();
    for (const file of files) {
      if (file.buffer.byteLength > MAX_SIZE) {
        logState.add(`Attachment rejected: ${file.name} exceeds 30MB limit`);
        continue;
      }
      try {
        const attachment = await window.api.addAttachment(
          projectState.selectedFileId, file.buffer, file.name
        );
        projectState.addAttachment(projectState.selectedFileId, attachment);
      } catch (err) {
        logState.add(`Attachment failed: ${err.message}`);
      }
    }
  }

  async function handleDelete(attachment) {
    if (!confirm(`Remove "${attachment.originalName}"?`)) return;
    try {
      await window.api.removeAttachment(projectState.selectedFileId, attachment.id);
      projectState.removeAttachment(projectState.selectedFileId, attachment.id);
    } catch (err) {
      logState.add(`Remove failed: ${err.message}`);
    }
  }

  async function handleOpen(attachment) {
    try {
      const absPath = await window.api.getAttachmentPath(attachment.filename);
      await window.api.openPath(absPath);
    } catch { /* ignore */ }
  }

</script>

<div class="attachment-panel">
  <div class="panel-header">
    <span class="panel-title">ATTACHMENTS</span>
    {#if projectState.selectedFileId}
      <button class="add-btn" onclick={handleAddFiles} title="Add attachment">
        <i class="fas fa-plus"></i>
      </button>
    {/if}
  </div>
  <div class="panel-body">
    {#if !projectState.selectedFileId}
      <p class="empty-msg">No file selected</p>
    {:else if projectState.selectedFileAttachments.length === 0}
      <p class="empty-msg">No attachments</p>
    {:else}
      {#each projectState.selectedFileAttachments as attachment (attachment.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="attachment-item" ondblclick={() => handleOpen(attachment)}>
          {#if isImage(attachment.originalName)}
            <img
              class="thumbnail"
              src={getThumbnailUrl(attachment)}
              alt={attachment.originalName}
            />
          {:else}
            <div class="file-icon">
              <i class="fas {getFileIcon(attachment.originalName)}"></i>
              <span class="file-type">{getFileType(attachment.originalName)}</span>
            </div>
          {/if}
          <span class="attachment-name" title={attachment.originalName}>
            {attachment.originalName}
          </span>
          <button class="delete-btn" onclick={() => handleDelete(attachment)} title="Remove attachment">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .attachment-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-surface);
  }

  .panel-header {
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

  .panel-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .add-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 12px;
  }

  .add-btn:hover {
    background: var(--bg-button);
    color: var(--text-primary);
  }

  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .empty-msg {
    color: var(--text-muted);
    font-size: 12px;
    text-align: center;
    padding: 24px 8px;
    font-style: italic;
  }

  .attachment-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    border-radius: 6px;
    cursor: pointer;
    position: relative;
    margin-bottom: 4px;
    transition: background 0.1s;
  }

  .attachment-item:hover {
    background: var(--bg-item-hover);
  }

  .thumbnail {
    width: 100%;
    max-height: 120px;
    object-fit: cover;
    border-radius: 4px;
    background: var(--bg-base);
  }

  .file-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 16px 8px;
    background: var(--bg-base);
    border-radius: 4px;
    color: var(--text-muted);
  }

  .file-icon i {
    font-size: 24px;
  }

  .file-type {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .attachment-name {
    font-size: 11px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .delete-btn {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 20px;
    height: 20px;
    display: none;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 11px;
    background: var(--bg-button);
  }

  .attachment-item:hover .delete-btn {
    display: flex;
  }

  .delete-btn:hover {
    background: var(--bg-button-hover);
    color: var(--text-primary);
  }
</style>

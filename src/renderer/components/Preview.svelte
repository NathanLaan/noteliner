<script>
  import { projectState } from '../stores/project.svelte.js';
  import { marked } from 'marked';
  import ContextMenu from './ContextMenu.svelte';

  let { onClose = () => {}, onSaveToHtml = () => {}, onSaveToPdf = () => {} } = $props();

  let previewContentEl;
  let contextMenu = $state(null);

  function resolveAttachmentUrls(rawHtml) {
    return rawHtml.replace(
      /(?:src|href)="\.?\/?_attachments\/([^"]+)"/g,
      (match, filename) => match.replace(`./_attachments/${filename}`, `attachment:///${encodeURIComponent(filename)}`)
        .replace(`_attachments/${filename}`, `attachment:///${encodeURIComponent(filename)}`)
    );
  }

  function handleSelectAll() {
    if (!previewContentEl) return;
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(previewContentEl);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function handleCopy() {
    document.execCommand('copy');
  }

  function handleContextMenu(e) {
    e.preventDefault();
    const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
    contextMenu = {
      x: e.clientX / zoom,
      y: e.clientY / zoom,
      items: [
        { label: 'Select All', icon: 'fa-object-group', action: handleSelectAll },
        { label: 'Copy', icon: 'fa-copy', action: handleCopy },
        { separator: true },
        { label: 'Save to HTML', icon: 'fa-file-code', action: onSaveToHtml },
        { label: 'Save to PDF', icon: 'fa-file-pdf', action: onSaveToPdf },
      ]
    };
  }

  let html = $derived(projectState.editorContent
    ? resolveAttachmentUrls(marked(projectState.editorContent))
    : '<p class="empty">Nothing to preview</p>');
</script>

<div class="preview-wrapper">
  <div class="preview-toolbar">
    <span class="preview-title">PREVIEW</span>
    <button class="close-btn" onclick={onClose} title="Close Preview">
      <i class="fas fa-xmark"></i>
    </button>
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="preview-content" bind:this={previewContentEl} oncontextmenu={handleContextMenu}>
    {@html html}
  </div>
</div>

{#if contextMenu}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    items={contextMenu.items}
    onClose={() => contextMenu = null}
  />
{/if}

<style>
  .preview-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .preview-toolbar {
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

  .preview-title {
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

  .preview-content {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
    line-height: 1.6;
  }

  .preview-content :global(h1) { font-size: 24px; margin-bottom: 12px; color: var(--text-primary); }
  .preview-content :global(h2) { font-size: 20px; margin-bottom: 10px; color: var(--text-primary); }
  .preview-content :global(h3) { font-size: 17px; margin-bottom: 8px; color: var(--text-primary); }
  .preview-content :global(p) { margin-bottom: 12px; color: var(--text-tertiary); }
  .preview-content :global(a) { color: var(--accent); }
  .preview-content :global(code) { background: var(--code-bg); padding: 2px 6px; border-radius: 4px; font-size: 13px; }
  .preview-content :global(pre) { background: var(--pre-bg); padding: 12px; border-radius: 6px; overflow-x: auto; margin-bottom: 12px; }
  .preview-content :global(pre code) { background: none; padding: 0; }
  .preview-content :global(blockquote) { border-left: 3px solid var(--blockquote-border); padding-left: 12px; color: var(--text-secondary); margin-bottom: 12px; }
  .preview-content :global(ul), .preview-content :global(ol) { padding-left: 24px; margin-bottom: 12px; }
  .preview-content :global(li) { margin-bottom: 4px; }
  .preview-content :global(img) { max-width: 100%; height: auto; border-radius: 4px; }
  .preview-content :global(.empty) { color: var(--text-muted); font-style: italic; }
</style>

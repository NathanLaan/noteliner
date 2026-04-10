<script>
  import { projectState } from '../stores/project.svelte.js';
  import { marked } from 'marked';

  let html = $derived(projectState.editorContent ? marked(projectState.editorContent) : '<p class="empty">Nothing to preview</p>');
</script>

<div class="preview-wrapper">
  <div class="preview-toolbar">
    <span class="preview-title">Preview</span>
  </div>
  <div class="preview-content">
    {@html html}
  </div>
</div>

<style>
  .preview-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .preview-toolbar {
    padding: 8px 16px;
    background: var(--bg-base);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .preview-title {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 500;
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
  .preview-content :global(.empty) { color: var(--text-muted); font-style: italic; }
</style>

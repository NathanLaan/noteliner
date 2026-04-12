<script>
  import { projectState } from '../stores/project.svelte.js';

  function extractHeadings(content) {
    if (!content) return [];
    const headings = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(#{1,4})\s+(.+)/);
      if (match) {
        headings.push({
          level: match[1].length,
          text: match[2].trim(),
          line: i + 1
        });
      }
    }
    return headings;
  }

  let headings = $derived(extractHeadings(projectState.editorContent));

  function handleClick(line) {
    projectState.scrollToLine = { line, ts: Date.now() };
  }
</script>

<div class="outline-pane">
  <div class="outline-header">
    <span class="outline-title">OUTLINE</span>
  </div>
  <div class="outline-list">
    {#each headings as h (h.line)}
      <div
        class="outline-item level-{h.level}"
        style="padding-left: {8 + (h.level - 1) * 14}px"
        onclick={() => handleClick(h.line)}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(h.line); } }}
        role="link"
        tabindex="0"
      >
        {h.text}
      </div>
    {/each}
    {#if headings.length === 0}
      <span class="outline-empty">No headings</span>
    {/if}
  </div>
</div>

<style>
  .outline-pane {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--border);
    max-height: 40%;
  }

  .outline-header {
    padding: 6px 12px;
    display: flex;
    align-items: center;
    background: var(--bg-base);
    flex-shrink: 0;
  }

  .outline-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .outline-list {
    overflow-y: auto;
    padding: 4px 0;
    flex: 1;
  }

  .outline-item {
    padding: 4px 8px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: background 0.1s;
  }

  .outline-item:hover {
    background: var(--bg-item-hover);
    color: var(--text-primary);
  }

  .outline-item.level-1 {
    font-weight: 600;
    color: var(--text-primary);
  }

  .outline-item.level-2 {
    font-weight: 500;
  }

  .outline-empty {
    display: block;
    padding: 8px 12px;
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
  }
</style>

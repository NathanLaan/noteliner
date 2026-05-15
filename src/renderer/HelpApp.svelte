<script>
  import { onMount } from 'svelte';
  import Preview from './components/Preview.svelte';
  import { helpPages } from './lib/helpContent.js';

  let query = $state('');
  let selectedId = $state(helpPages[0]?.id ?? null);
  // Left-pane width as a percentage of the dialog body width. Drag the
  // vertical resizer to adjust. Initial split: 30% / 70%.
  let leftPct = $state(30);

  let bodyEl;
  let searchEl;

  function focusSearch(node) {
    searchEl = node;
    setTimeout(() => node.focus(), 0);
  }

  // Match against title + body + section, case-insensitive. Empty query →
  // every page counts as a match (everything shown normally, none grayed).
  function pageMatches(page, q) {
    if (!q) return true;
    const needle = q.toLowerCase();
    return (
      page.title.toLowerCase().includes(needle) ||
      page.body.toLowerCase().includes(needle) ||
      (page.section || '').toLowerCase().includes(needle)
    );
  }

  let trimmedQuery = $derived(query.trim());
  let pagesWithMatch = $derived(
    helpPages.map((p) => ({ page: p, matches: pageMatches(p, trimmedQuery) }))
  );
  let hasQuery = $derived(trimmedQuery.length > 0);
  let matchCount = $derived(pagesWithMatch.filter((x) => x.matches).length);

  // Group by section, preserving original order.
  let grouped = $derived.by(() => {
    const order = [];
    const bySection = new Map();
    for (const { page, matches } of pagesWithMatch) {
      const sec = page.section || 'Other';
      if (!bySection.has(sec)) {
        bySection.set(sec, []);
        order.push(sec);
      }
      bySection.get(sec).push({ page, matches });
    }
    return order.map((sec) => ({ section: sec, items: bySection.get(sec) }));
  });

  let selectedPage = $derived(
    helpPages.find((p) => p.id === selectedId) || helpPages[0] || null
  );

  function handleSelect(id) {
    selectedId = id;
  }

  function startResize(e) {
    e.preventDefault();
    const rect = bodyEl.getBoundingClientRect();
    const zoom =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')
      ) || 1;

    function onMove(ev) {
      const x = (ev.clientX - rect.left) / zoom;
      const w = rect.width / zoom;
      const pct = (x / w) * 100;
      leftPct = Math.max(15, Math.min(70, pct));
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handleKeydown(e) {
    // Esc closes the help window.
    if (e.key === 'Escape') {
      window.close();
    }
  }

  onMount(() => {
    document.title = 'NoteLiner Help';
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="help-root">
  <div class="help-body" bind:this={bodyEl}>
    <div class="help-index" style="width: {leftPct}%">
      <div class="search-row">
        <i class="fas fa-magnifying-glass search-icon"></i>
        <input
          use:focusSearch
          type="text"
          class="search-input"
          placeholder="Search help…"
          bind:value={query}
        />
        {#if hasQuery}
          <button class="clear-btn" onclick={() => (query = '')} title="Clear">
            <i class="fas fa-xmark"></i>
          </button>
        {/if}
      </div>

      {#if hasQuery}
        <div class="search-summary">
          {matchCount} match{matchCount === 1 ? '' : 'es'}
        </div>
      {/if}

      <div class="index-list">
        {#each grouped as group (group.section)}
          <div class="index-section">{group.section}</div>
          {#each group.items as { page, matches } (page.id)}
            <button
              class="index-item"
              class:active={page.id === selectedId}
              class:dim={hasQuery && !matches}
              class:hit={hasQuery && matches}
              onclick={() => handleSelect(page.id)}
            >
              {page.title}
            </button>
          {/each}
        {/each}
      </div>
    </div>

    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="help-resizer"
      role="separator"
      aria-orientation="vertical"
      tabindex="-1"
      onmousedown={startResize}
    ></div>

    <div class="help-content">
      {#if selectedPage}
        <Preview
          source={selectedPage.body}
          showToolbar={false}
          projectActions={false}
        />
      {:else}
        <div class="empty">No help page selected.</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .help-root {
    display: flex;
    flex-direction: column;
    height: var(--ui-zoom-height, 100vh);
    width: var(--ui-zoom-width, 100vw);
    zoom: var(--ui-zoom, 1);
    background: var(--bg-surface);
    overflow: hidden;
  }

  .help-body {
    flex: 1;
    display: flex;
    min-height: 0;
    overflow: hidden;
  }

  .help-index {
    display: flex;
    flex-direction: column;
    min-width: 160px;
    background: var(--bg-base);
    border-right: 1px solid var(--border);
    overflow: hidden;
  }

  .search-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .search-icon {
    font-size: 12px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    padding: 6px 8px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 13px;
    outline: none;
    min-width: 0;
  }

  .search-input:focus {
    border-color: var(--input-border-focus);
  }

  .clear-btn {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 11px;
    flex-shrink: 0;
  }

  .clear-btn:hover {
    background: var(--bg-button-hover);
    color: var(--text-primary);
  }

  .search-summary {
    padding: 6px 12px;
    font-size: 11px;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .index-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px 0 12px;
    min-height: 0;
  }

  .index-section {
    padding: 12px 14px 4px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .index-item {
    display: block;
    width: 100%;
    padding: 6px 14px;
    font-size: 13px;
    color: var(--text-primary);
    text-align: left;
    transition: background 0.1s, color 0.1s, opacity 0.15s;
    border-left: 2px solid transparent;
  }

  .index-item:hover {
    background: var(--bg-item-hover);
  }

  .index-item.active {
    background: var(--bg-selected);
    color: var(--accent);
    border-left-color: var(--accent);
  }

  .index-item.hit {
    color: var(--accent);
    font-weight: 600;
  }

  .index-item.hit.active {
    color: var(--accent);
  }

  .index-item.dim {
    color: var(--text-muted);
    opacity: 0.45;
    font-weight: 400;
  }

  .help-resizer {
    width: 4px;
    cursor: col-resize;
    background: var(--border);
    flex-shrink: 0;
    transition: background 0.15s;
  }

  .help-resizer:hover {
    background: var(--border-hover);
  }

  .help-content {
    flex: 1;
    min-width: 200px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--bg-surface);
  }

  .empty {
    padding: 16px;
    color: var(--text-muted);
    font-style: italic;
  }
</style>

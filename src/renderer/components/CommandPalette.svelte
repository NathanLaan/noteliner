<script>
  import { onMount } from 'svelte';
  import { commandRegistry } from '../stores/commands.svelte.js';
  import { projectState } from '../stores/project.svelte.js';
  import { fuzzyScore } from '../lib/fuzzy.js';

  let { onClose, onOpenRecent } = $props();

  let query = $state('');
  let selectedIndex = $state(0);
  let recentProjects = $state([]);
  let inputEl;
  let listEl;

  onMount(() => {
    window.api?.getRecentProjects?.()
      .then((list) => { recentProjects = list || []; })
      .catch(() => {});
  });

  // Highlights the matched substring in `label` for the current query.
  // Returns segments [{text, match}]; the template wraps matches in <mark>.
  function highlight(label, q) {
    if (!q) return [{ text: label, match: false }];
    const lower = label.toLowerCase();
    const idx = lower.indexOf(q.toLowerCase());
    if (idx < 0) return [{ text: label, match: false }];
    return [
      { text: label.slice(0, idx), match: false },
      { text: label.slice(idx, idx + q.length), match: true },
      { text: label.slice(idx + q.length), match: false },
    ];
  }

  // Trim a recent-project path to its last two segments for compactness.
  function shortPath(p) {
    if (!p) return '';
    const parts = p.split(/[\\/]/).filter(Boolean);
    if (parts.length <= 2) return p;
    return '.../' + parts.slice(-2).join('/');
  }

  // Result item shape: { kind, id, label, sub, section, score, run }
  // kind = 'command' | 'note' | 'tag' | 'recent'
  const items = $derived.by(() => {
    const q = query.trim();
    const out = [];

    // Commands — always shown; with empty query, sorted by registry recency.
    const cmds = commandRegistry.applicableCommands();
    for (const c of cmds) {
      const score = fuzzyScore(c.label, q);
      if (q && score === 0) continue;
      out.push({
        kind: 'command',
        id: c.id,
        label: c.label,
        sub: c.shortcut || '',
        section: c.section || 'Command',
        score: score + (q ? 0 : 1000),
        run: () => commandRegistry.run(c.id),
      });
    }

    // Tags — only when a query is present and a project is open.
    if (q && projectState.isOpen) {
      for (const tag of projectState.allTags) {
        const score = fuzzyScore(tag, q);
        if (score === 0) continue;
        const files = projectState.getFilesWithTag(tag);
        out.push({
          kind: 'tag',
          id: 'tag:' + tag,
          label: '#' + tag,
          sub: files.length + (files.length === 1 ? ' note' : ' notes'),
          section: 'Tag',
          score,
          run: () => { if (files[0]) projectState.selectFile(files[0].id); },
        });
      }
    }

    // Notes — only when a query is present and a project is open.
    if (q && projectState.isOpen) {
      for (const f of projectState.index.files) {
        const score = fuzzyScore(f.name, q);
        if (score === 0) continue;
        out.push({
          kind: 'note',
          id: 'note:' + f.id,
          label: f.name,
          sub: f.filename,
          section: 'Note',
          score,
          run: () => projectState.selectFile(f.id),
        });
      }
    }

    // Recent projects — show always when no project is open (palette replaces
    // OpenScreen for keyboard users). When a project is open, show only on
    // query so they don't clutter the empty-query view.
    if (!projectState.isOpen || q) {
      for (const r of recentProjects) {
        const score = fuzzyScore(r.name, q);
        if (q && score === 0) continue;
        out.push({
          kind: 'recent',
          id: 'rp:' + r.path,
          label: r.name,
          sub: shortPath(r.path),
          section: 'Recent',
          score: score + (q ? 0 : 200),
          run: () => onOpenRecent && onOpenRecent(r.path),
        });
      }
    }

    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 50);
  });

  $effect(() => {
    // Reset selection whenever the visible list shape changes.
    void items;
    selectedIndex = 0;
  });

  function focusOnMount(node) {
    node.focus();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      scrollSelectedIntoView();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      scrollSelectedIntoView();
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      selectedIndex = 0;
      scrollSelectedIntoView();
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      selectedIndex = items.length - 1;
      scrollSelectedIntoView();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const it = items[selectedIndex];
      if (it) {
        it.run();
        onClose();
      }
    }
  }

  function scrollSelectedIntoView() {
    if (!listEl) return;
    const el = listEl.querySelector('.palette-row.selected');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function activate(it) {
    it.run();
    onClose();
  }
</script>

<div
  class="palette-backdrop"
  onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  onkeydown={onKeydown}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <div class="palette" onclick={(e) => e.stopPropagation()}>
    <div class="palette-input-row">
      <i class="fas fa-magnifying-glass"></i>
      <input
        bind:this={inputEl}
        bind:value={query}
        placeholder="Type a command or note name..."
        spellcheck="false"
        autocomplete="off"
        use:focusOnMount
      />
    </div>
    <ul class="palette-list" bind:this={listEl}>
      {#if items.length === 0}
        <li class="palette-empty">No matching commands or notes.</li>
      {:else}
        {#each items as it, i (it.id)}
          {#if i > 0 && items[i - 1].kind !== it.kind}
            <li class="palette-divider" aria-hidden="true"></li>
          {/if}
          <li
            class="palette-row"
            class:selected={i === selectedIndex}
            onmouseenter={() => selectedIndex = i}
            onclick={() => activate(it)}
          >
            <span class="palette-kind">
              {#if it.kind === 'command'}
                <i class="fas fa-bolt"></i>
              {:else if it.kind === 'note'}
                <i class="fas fa-file-lines"></i>
              {:else if it.kind === 'tag'}
                <i class="fas fa-tag"></i>
              {:else if it.kind === 'recent'}
                <i class="fas fa-folder"></i>
              {/if}
            </span>
            <span class="palette-label">
              {#each highlight(it.label, query) as seg}
                {#if seg.match}<mark>{seg.text}</mark>{:else}{seg.text}{/if}
              {/each}
            </span>
            {#if !it.sub}<span class="palette-section">{it.section}</span>{/if}
            {#if it.sub}<span class="palette-sub">{it.sub}</span>{/if}
          </li>
        {/each}
      {/if}
    </ul>
  </div>
</div>

<style>
  .palette-backdrop {
    position: fixed;
    inset: 0;
    background: var(--modal-overlay);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 18vh;
  }

  .palette {
    width: 600px;
    max-width: 90vw;
    max-height: 50vh;
    min-height: 240px;
    display: flex;
    flex-direction: column;
    background: var(--bg-surface);
    border-radius: 10px;
    /* Hard 1px ring + deep shadow lift the palette off the page so editor
       text behind the backdrop never visually competes with palette rows. */
    box-shadow:
      0 0 0 1px var(--border),
      0 16px 48px rgba(0, 0, 0, 0.55);
    overflow: hidden;
  }

  .palette-input-row {
    display: grid;
    grid-template-columns: 20px 1fr;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    background: var(--input-bg);
    border-bottom: 1px solid var(--border);
    color: var(--text-muted);
  }

  .palette-input-row i {
    text-align: center;
    font-size: 14px;
  }

  .palette-input-row input {
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 16px;
    line-height: 1.2;
    padding: 2px 0;
  }

  .palette-input-row input::placeholder {
    color: var(--text-muted);
  }

  .palette-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px 0;
    list-style: none;
    margin: 0;
  }

  .palette-row {
    display: grid;
    grid-template-columns: 24px 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 10px 18px;
    /* Reserve 3px for the selected-state accent bar so labels don't shift
       horizontally when the selection moves between rows. */
    border-left: 3px solid transparent;
    cursor: pointer;
    color: var(--text-primary);
    font-size: 14px;
    transition: background 0.08s, border-color 0.08s;
  }

  .palette-row.selected {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    border-left-color: var(--accent);
  }

  .palette-kind {
    color: var(--text-muted);
    font-size: 13px;
    text-align: center;
  }

  .palette-row.selected .palette-kind {
    color: var(--accent);
  }

  .palette-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .palette-label mark {
    background: color-mix(in srgb, var(--accent) 30%, transparent);
    color: var(--text-primary);
    border-radius: 2px;
    padding: 0;
  }

  .palette-row.selected .palette-label mark {
    background: color-mix(in srgb, var(--accent) 45%, transparent);
  }

  .palette-divider {
    height: 1px;
    background: var(--border);
    margin: 6px 14px;
    list-style: none;
    pointer-events: none;
  }

  .palette-section {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.6px;
    opacity: 0.7;
  }

  .palette-sub {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    color: var(--text-secondary);
    background: var(--bg-button);
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid var(--border);
    line-height: 1;
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .palette-row.selected .palette-sub {
    color: var(--text-primary);
    border-color: var(--accent);
  }

  .palette-empty {
    padding: 24px 16px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
    list-style: none;
  }
</style>

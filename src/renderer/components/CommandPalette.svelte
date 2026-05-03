<script>
  import { commandRegistry } from '../stores/commands.svelte.js';
  import { projectState } from '../stores/project.svelte.js';
  import { fuzzyScore } from '../lib/fuzzy.js';

  let { onClose } = $props();

  let query = $state('');
  let selectedIndex = $state(0);
  let inputEl;
  let listEl;

  // Result item shape: { kind, label, sub, score, run }
  // kind = 'command' | 'note'
  const items = $derived.by(() => {
    const q = query.trim();
    const out = [];

    // Commands.
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
        score: score + (q ? 0 : 1000),  // empty query: commands first, sorted by registry recency
        run: () => commandRegistry.run(c.id),
      });
    }

    // Notes (only when a query is present, and only when a project is open).
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
  use:focusOnMount
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
          <li
            class="palette-row"
            class:selected={i === selectedIndex}
            onmouseenter={() => selectedIndex = i}
            onclick={() => activate(it)}
          >
            <span class="palette-kind">
              {#if it.kind === 'command'}
                <i class="fas fa-bolt"></i>
              {:else}
                <i class="fas fa-file-lines"></i>
              {/if}
            </span>
            <span class="palette-label">{it.label}</span>
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

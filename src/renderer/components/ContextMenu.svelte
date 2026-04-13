<script>
  import { onMount } from 'svelte';

  let { x, y, items, onClose } = $props();

  function handleClickOutside(e) {
    onClose();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') onClose();
  }

  function handleItemClick(item) {
    onClose();
    if (item.action) item.action();
  }

  onMount(() => {
    // Delay listener to avoid the triggering right-click closing the menu
    const timer = setTimeout(() => {
      window.addEventListener('click', handleClickOutside);
      window.addEventListener('contextmenu', handleClickOutside);
    }, 0);
    window.addEventListener('keydown', handleKeydown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('contextmenu', handleClickOutside);
      window.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<div class="context-menu" style="left: {x}px; top: {y}px">
  {#each items as item}
    {#if item.separator}
      <div class="context-separator"></div>
    {:else}
      <button class="context-item" onclick={() => handleItemClick(item)}>
        {#if item.icon}
          <i class="fas {item.icon} context-icon"></i>
        {/if}
        <span>{item.label}</span>
      </button>
    {/if}
  {/each}
</div>

<style>
  .context-menu {
    position: fixed;
    z-index: 2000;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 4px 0;
    min-width: 180px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .context-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 7px 14px;
    font-size: 13px;
    color: var(--text-primary);
    text-align: left;
    transition: background 0.1s;
  }

  .context-item:hover {
    background: var(--bg-item-hover);
  }

  .context-icon {
    width: 16px;
    text-align: center;
    font-size: 12px;
    color: var(--text-muted);
  }

  .context-separator {
    height: 1px;
    background: var(--border);
    margin: 4px 8px;
  }
</style>

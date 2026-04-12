<script>
  import { projectState } from '../stores/project.svelte.js';
  import TagGroups from './TagGroups.svelte';

  let { selectedId, onSelect, onTagsChanged } = $props();
</script>

<div class="tag-groups-pane">
  <div class="tag-groups-header">
    <span class="tag-groups-title">TAG GROUPS</span>
  </div>
  <div class="tag-groups-list">
    <TagGroups {selectedId} {onSelect} {onTagsChanged} />
    {#if projectState.allTags.length === 0}
      <span class="tag-groups-empty">No tags</span>
    {/if}
  </div>
</div>

<style>
  .tag-groups-pane {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
    height: 100%;
  }

  .tag-groups-header {
    padding: 6px 12px;
    display: flex;
    align-items: center;
    background: var(--bg-base);
    flex-shrink: 0;
    border-bottom: 1px solid var(--border);
  }

  .tag-groups-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .tag-groups-list {
    overflow-y: auto;
    padding: 4px 0;
    flex: 1;
  }

  .tag-groups-empty {
    display: block;
    padding: 8px 12px;
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
  }
</style>

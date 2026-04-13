<script>
  import { projectState } from '../stores/project.svelte.js';
  import TagGroups from './TagGroups.svelte';

  let { selectedId, onSelect, onTagsChanged } = $props();
</script>

<div class="tag-groups-list">
  <TagGroups {selectedId} {onSelect} {onTagsChanged} />
  {#if projectState.allTags.length === 0}
    <span class="tag-groups-empty">No tags</span>
  {/if}
</div>

<style>
  .tag-groups-list {
    overflow-y: auto;
    padding: 4px 0;
    flex: 1;
    min-height: 0;
  }

  .tag-groups-empty {
    display: block;
    padding: 8px 12px;
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
  }
</style>

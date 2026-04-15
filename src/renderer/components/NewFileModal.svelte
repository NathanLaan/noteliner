<script>
  import { projectState } from '../stores/project.svelte.js';

  let { onConfirm, onCancel } = $props();

  let fileName = $state('');
  let selectedTags = $state(new Set());

  let allTags = $derived(projectState.allTags);

  function focusOnMount(node) {
    node.focus();
  }

  function focusInput(node) {
    node.focus();
    node.select();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter' && !e.shiftKey) handleOk();
  }

  function toggleTag(tag) {
    const next = new Set(selectedTags);
    if (next.has(tag)) {
      next.delete(tag);
    } else {
      next.add(tag);
    }
    selectedTags = next;
  }

  function handleOk() {
    const name = fileName.trim() || 'Untitled';
    onConfirm({ name, tags: [...selectedTags] });
  }
</script>

<div class="modal-overlay" use:focusOnMount onclick={(e) => { if (e.target === e.currentTarget) onCancel(); }} onkeydown={handleKeydown} role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal new-file-modal">
    <div class="modal-header">
      <h2>New File</h2>
    </div>
    <div class="modal-body">
      <div class="field">
        <label for="new-file-name">File Name:</label>
        <input id="new-file-name" type="text" bind:value={fileName} placeholder="Untitled" use:focusInput />
      </div>

      {#if allTags.length > 0}
        <div class="field">
          <label>Tags:</label>
          <div class="tag-list">
            {#each allTags as tag (tag)}
              <button
                class="tag-item"
                class:selected={selectedTags.has(tag)}
                onclick={() => toggleTag(tag)}
              >
                <span class="tag-check">{selectedTags.has(tag) ? '✓' : ''}</span>
                <span class="tag-name">{tag}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <div class="modal-footer">
        <button class="cancel-btn" onclick={onCancel}>Cancel</button>
        <button class="ok-btn" onclick={handleOk}>OK</button>
      </div>
    </div>
  </div>
</div>

<style>
  .new-file-modal {
    max-width: 480px;
    max-height: 520px;
    height: auto;
    margin: auto;
    width: 100%;
  }

  .field {
    margin-bottom: 14px;
  }

  .field label {
    display: block;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }

  .field input {
    width: 100%;
    padding: 8px 12px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
  }

  .field input:focus {
    border-color: var(--input-border-focus);
  }

  .tag-list {
    max-height: 260px;
    overflow-y: auto;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    background: var(--input-bg);
  }

  .tag-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 6px 12px;
    font-size: 13px;
    color: var(--text-primary);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    text-align: left;
    gap: 8px;
    transition: background 0.1s;
  }

  .tag-item:last-child {
    border-bottom: none;
  }

  .tag-item:hover {
    background: var(--bg-button-hover);
  }

  .tag-item.selected {
    background: var(--bg-selected);
  }

  .tag-check {
    width: 16px;
    flex-shrink: 0;
    font-size: 12px;
    color: var(--accent);
    text-align: center;
  }

  .tag-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }

  .cancel-btn {
    padding: 8px 20px;
    color: var(--text-muted);
    border-radius: 6px;
    transition: color 0.15s;
  }

  .cancel-btn:hover {
    color: var(--text-secondary);
  }

  .ok-btn {
    padding: 8px 24px;
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
  }

  .ok-btn:hover {
    background: var(--accent);
    color: var(--accent-on);
  }
</style>

<script>
  import { onMount, onDestroy } from 'svelte';
  import { projectState } from '../stores/project.svelte.js';
  import { EditorView, basicSetup } from 'codemirror';
  import { markdown } from '@codemirror/lang-markdown';
  import { languages } from '@codemirror/language-data';
  import { EditorState } from '@codemirror/state';
  import { oneDark } from '@codemirror/theme-one-dark';

  let { onTogglePreview, showPreview } = $props();

  let editorContainer;
  let editorView = null;
  let saveTimeout = null;
  let currentFileId = null;
  let isUpdating = false;

  // Custom theme overrides
  const customTheme = EditorView.theme({
    '&': { height: '100%', fontSize: '14px' },
    '.cm-scroller': { overflow: 'auto' },
    '.cm-content': { padding: '16px 0' },
    '.cm-line': { padding: '0 16px' }
  });

  function createEditor() {
    if (editorView) {
      editorView.destroy();
    }

    const startState = EditorState.create({
      doc: projectState.editorContent || '',
      extensions: [
        basicSetup,
        markdown({ codeLanguages: languages }),
        oneDark,
        customTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isUpdating) {
            const content = update.state.doc.toString();
            projectState.editorContent = content;
            scheduleSave(content);
          }
        }),
        EditorView.lineWrapping
      ]
    });

    editorView = new EditorView({
      state: startState,
      parent: editorContainer
    });
  }

  function scheduleSave(content) {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      const file = projectState.selectedFile;
      if (file) {
        await window.api.writeFile(file.filename, content);
      }
    }, 500);
  }

  function updateEditorContent(content) {
    if (!editorView) return;
    isUpdating = true;
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: content || ''
      }
    });
    isUpdating = false;
  }

  onMount(() => {
    createEditor();
  });

  onDestroy(() => {
    if (editorView) editorView.destroy();
    if (saveTimeout) clearTimeout(saveTimeout);
  });

  // Watch for file selection changes
  $effect(() => {
    const fileId = projectState.selectedFileId;
    const content = projectState.editorContent;

    if (fileId !== currentFileId) {
      currentFileId = fileId;
      if (editorView) {
        updateEditorContent(content);
      }
    }
  });
</script>

<div class="editor-wrapper">
  <div class="editor-toolbar">
    {#if projectState.selectedFile}
      <span class="file-name">{projectState.selectedFile.name}</span>
    {:else}
      <span class="no-file">No file selected</span>
    {/if}
    <div class="editor-actions">
      <button
        class="editor-btn"
        class:active={showPreview}
        onclick={onTogglePreview}
        title="Toggle Preview"
      >
        <i class="fas fa-eye"></i>
      </button>
    </div>
  </div>
  <div class="editor-container" bind:this={editorContainer}></div>
</div>

<style>
  .editor-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-surface);
  }

  .editor-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: var(--bg-base);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .file-name {
    font-size: 13px;
    color: var(--text-primary);
    font-weight: 500;
  }

  .no-file {
    font-size: 13px;
    color: var(--text-muted);
    font-style: italic;
  }

  .editor-actions {
    display: flex;
    gap: 4px;
  }

  .editor-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .editor-btn:hover {
    background: var(--bg-button);
    color: var(--text-primary);
  }

  .editor-btn.active {
    color: var(--accent);
  }

  .editor-container {
    flex: 1;
    overflow: hidden;
  }

  .editor-container :global(.cm-editor) {
    height: 100%;
  }
</style>

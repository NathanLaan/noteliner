<script>
  import { onMount, onDestroy } from 'svelte';
  import { projectState } from '../stores/project.svelte.js';
  import { logState } from '../stores/log.svelte.js';
  import { EditorView, basicSetup } from 'codemirror';
  import { markdown } from '@codemirror/lang-markdown';
  import { languages } from '@codemirror/language-data';
  import { EditorState } from '@codemirror/state';
  import { oneDark } from '@codemirror/theme-one-dark';

  let { onTogglePreview, showPreview } = $props();

  const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
  const MAX_SIZE = 30 * 1024 * 1024;

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

  function getExtension(name) {
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot).toLowerCase() : '';
  }

  function isImage(name) {
    return IMAGE_EXTENSIONS.includes(getExtension(name));
  }

  function insertMarkdownReference(attachment) {
    if (!editorView) return;
    const path = `./_attachments/${attachment.filename}`;
    const ref = isImage(attachment.originalName)
      ? `![${attachment.originalName}](${path})`
      : `[${attachment.originalName}](${path})`;
    const pos = editorView.state.selection.main.head;
    editorView.dispatch({
      changes: { from: pos, insert: ref + '\n' }
    });
  }

  async function processFiles(files) {
    if (!projectState.selectedFileId) return;
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        logState.add(`Attachment rejected: ${file.name} exceeds 30MB limit`);
        continue;
      }
      try {
        const buffer = await file.arrayBuffer();
        const attachment = await window.api.addAttachment(
          projectState.selectedFileId, buffer, file.name
        );
        projectState.addAttachment(projectState.selectedFileId, attachment);
        insertMarkdownReference(attachment);
      } catch (err) {
        logState.add(`Attachment failed: ${err.message}`);
      }
    }
  }

  function handlePaste(e) {
    const files = e.clipboardData?.files;
    if (files && files.length > 0 && projectState.selectedFileId) {
      e.preventDefault();
      processFiles(files);
    }
  }

  function handleDragOver(e) {
    if (projectState.selectedFileId) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  function handleDrop(e) {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0 && projectState.selectedFileId) {
      e.preventDefault();
      processFiles(files);
    }
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
        title="Toggle Preview (Ctrl+P)"
      >
        <i class="fas fa-eye"></i>
      </button>
    </div>
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="editor-container" bind:this={editorContainer} onpaste={handlePaste} ondragover={handleDragOver} ondrop={handleDrop}></div>
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

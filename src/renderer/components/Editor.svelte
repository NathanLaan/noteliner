<script>
  import { onMount, onDestroy } from 'svelte';
  import { projectState } from '../stores/project.svelte.js';
  import { themeState } from '../stores/theme.svelte.js';
  import { logState } from '../stores/log.svelte.js';
  import { EditorView, basicSetup } from 'codemirror';
  import { markdown } from '@codemirror/lang-markdown';
  import { languages } from '@codemirror/language-data';
  import { EditorState } from '@codemirror/state';
  import { oneDark } from '@codemirror/theme-one-dark';

  const lightTheme = EditorView.theme({
    '&': { backgroundColor: '#ffffff', color: '#1a1a1a' },
    '.cm-content': { caretColor: '#1a1a1a' },
    '.cm-cursor': { borderLeftColor: '#1a1a1a' },
    '.cm-activeLine': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
    '.cm-selectionMatch': { backgroundColor: 'rgba(50, 120, 220, 0.15)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'rgba(50, 120, 220, 0.2)' },
    '.cm-gutters': { backgroundColor: '#f5f5f5', color: '#999999', borderRight: '1px solid #e0e0e0' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(0, 0, 0, 0.06)' },
    '.cm-foldPlaceholder': { backgroundColor: '#e8e8e8', color: '#666666' },
  }, { dark: false });

  let { onTogglePreview, showPreview, onGitConfigRequired = () => {} } = $props();

  const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
  const MAX_SIZE = 30 * 1024 * 1024;

  let editorContainer;
  let editorView = null;
  let saveTimeout = null;
  let currentFileId = null;
  let currentTheme = null;
  let isUpdating = false;

  // Custom theme overrides
  const customTheme = EditorView.theme({
    '&': { height: '100%', fontSize: '14px' },
    '.cm-scroller': { overflow: 'auto' },
    '.cm-content': { padding: '16px 0' },
    '.cm-line': { padding: '0 16px' },
    '.cm-lineNumbers': { minWidth: '44px' },
  });

  function getEditorTheme() {
    return themeState.current === 'light' ? lightTheme : oneDark;
  }

  function createEditor() {
    if (editorView) {
      editorView.destroy();
    }

    const startState = EditorState.create({
      doc: projectState.editorContent || '',
      extensions: [
        basicSetup,
        markdown({ codeLanguages: languages }),
        getEditorTheme(),
        customTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isUpdating) {
            const content = update.state.doc.toString();
            projectState.editorContent = content;
            scheduleSave(content);
          }
          if (update.selectionSet || update.docChanged) {
            const pos = update.state.selection.main.head;
            projectState.cursorLine = update.state.doc.lineAt(pos).number;
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
        const result = await window.api.writeFile(file.filename, content);
        if (result && result.error === 'git_config_required') {
          onGitConfigRequired();
        }
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
    // Internal file drags are intercepted in capture phase (interceptInternalDrops).
    // This handler only processes external file drops (attachments).
    if (!projectState.selectedFileId) return;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      e.preventDefault();
      processFiles(files);
    }
  }

  // Capture-phase interceptor for internal file drags from FileTree.
  // Runs BEFORE CodeMirror's own drop handler, which would otherwise insert the UUID as text.
  function interceptInternalDrops(node) {
    function isInternalDrag(e) {
      const types = e.dataTransfer?.types;
      // Internal drags carry text/plain (the file UUID) but no Files
      return types && types.includes('text/plain') && !types.includes('Files');
    }

    function onDragOver(e) {
      if (!projectState.selectedFileId) return;
      if (isInternalDrag(e)) {
        e.preventDefault();
        e.stopPropagation();
        // Must match FileTree's effectAllowed='move'. Browsers reject the drop
        // if dropEffect doesn't match effectAllowed.
        e.dataTransfer.dropEffect = 'move';
      }
    }

    function onDrop(e) {
      if (!projectState.selectedFileId) return;
      if (!isInternalDrag(e)) return;

      const fileId = e.dataTransfer.getData('text/plain');
      if (!fileId) return;

      const file = projectState.index.files.find(f => f.id === fileId);
      if (!file || file.id === projectState.selectedFileId) {
        // Still prevent default so the UUID isn't inserted
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (!editorView) return;
      const ref = `[${file.name}](./${file.filename})`;
      const pos = editorView.posAtCoords({ x: e.clientX, y: e.clientY }) ?? editorView.state.selection.main.head;
      editorView.dispatch({ changes: { from: pos, insert: ref } });
      editorView.focus();
    }

    node.addEventListener('dragover', onDragOver, true);
    node.addEventListener('drop', onDrop, true);
    return {
      destroy() {
        node.removeEventListener('dragover', onDragOver, true);
        node.removeEventListener('drop', onDrop, true);
      }
    };
  }

  onMount(() => {
    currentTheme = themeState.current;
    createEditor();
  });

  // Recreate editor when theme changes
  $effect(() => {
    const theme = themeState.current;
    if (currentTheme !== null && theme !== currentTheme) {
      currentTheme = theme;
      if (editorContainer) createEditor();
    }
  });

  onDestroy(() => {
    if (editorView) editorView.destroy();
    if (saveTimeout) clearTimeout(saveTimeout);
  });

  // Watch for scroll-to-line requests from outline
  $effect(() => {
    const req = projectState.scrollToLine;
    if (req && editorView) {
      const lineCount = editorView.state.doc.lines;
      const lineNum = Math.min(req.line, lineCount);
      const line = editorView.state.doc.line(lineNum);
      editorView.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: 'start' })
      });
      editorView.focus();
    }
  });

  // Watch for file selection and content changes
  $effect(() => {
    const fileId = projectState.selectedFileId;
    const content = projectState.editorContent;

    if (fileId !== currentFileId) {
      currentFileId = fileId;
    }

    // Update editor only when content differs (avoids circular updates from user typing)
    if (editorView) {
      const current = editorView.state.doc.toString();
      if (current !== (content || '')) {
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
  <div class="editor-container" bind:this={editorContainer} use:interceptInternalDrops onpaste={handlePaste} ondragover={handleDragOver} ondrop={handleDrop}></div>
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
    padding: 8px 12px;
    min-height: 44px;
    box-sizing: border-box;
    background: var(--bg-base);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .file-name {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .no-file {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
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

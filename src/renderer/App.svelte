<script>
  import { onMount } from 'svelte';
  import Toolbar from './components/Toolbar.svelte';
  import TitleBar from './components/TitleBar.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import Editor from './components/Editor.svelte';
  import Preview from './components/Preview.svelte';
  import LogPanel from './components/LogPanel.svelte';
  import OpenScreen from './components/OpenScreen.svelte';
  import AboutModal from './components/AboutModal.svelte';
  import SetupModal from './components/SetupModal.svelte';
  import SettingsModal from './components/SettingsModal.svelte';
  import ProjectSettingsModal from './components/ProjectSettingsModal.svelte';
  import NewProjectModal from './components/NewProjectModal.svelte';
  import NewFileModal from './components/NewFileModal.svelte';
  import DeleteFileModal from './components/DeleteFileModal.svelte';
  import ClearTagsModal from './components/ClearTagsModal.svelte';
  import SyncModal from './components/SyncModal.svelte';
  import SyncingModal from './components/SyncingModal.svelte';
  import HistoryPanel from './components/HistoryPanel.svelte';
  import AttachmentPanel from './components/AttachmentPanel.svelte';
  import { projectState } from './stores/project.svelte.js';
  import { themeState } from './stores/theme.svelte.js';

  const VALID_PANE_KEYS = ['files', 'tagGroups', 'outline', 'tags', 'search'];

  const DEFAULT_LAYOUT = {
    showPreview: false,
    showHistory: false,
    showLog: false,
    showToolbar: true,
    showSidebar: true,
    showOutline: false,
    showTags: true,
    showTagGroups: false,
    showAttachments: false,
    showSearch: false,
    sidebarWidth: 260,
    logPanelHeight: 300,
    attachmentPanelWidth: 220,
    filesHeight: 200,
    tagGroupsHeight: 150,
    outlineHeight: 150,
    tagsHeight: 100,
    searchHeight: 200,
    paneOrder: ['files', 'tagGroups', 'outline', 'tags', 'search'],
  };

  function normalizePaneOrder(order) {
    const valid = Array.isArray(order) ? order.filter(k => VALID_PANE_KEYS.includes(k)) : [];
    const missing = VALID_PANE_KEYS.filter(k => !valid.includes(k));
    return [...valid, ...missing];
  }

  let layout = $state({ ...DEFAULT_LAYOUT });

  // Transient modal/action state (not persisted)
  let showAbout = $state(false);
  let showSetup = $state(false);
  let showSettings = $state(false);
  let showProjectSettings = $state(false);
  let showNewProject = $state(false);
  let showSync = $state(false);
  let showNewFile = $state(false);
  let showDeleteFile = $state(false);
  let showSyncing = $state(false);
  let showClearTags = $state(false);
  let clearTagsFile = $state(null);
  let projectSettingsRequired = $state(false);
  let tagAction = $state(null);
  let searchFocusTs = $state(null);
  let setupFolderPath = $state('');
  let customTitlebar = $state(false);

  // Debounced layout save
  let layoutSaveTimer = null;
  function scheduleLayoutSave() {
    if (!projectState.isOpen) return;
    if (layoutSaveTimer) clearTimeout(layoutSaveTimer);
    layoutSaveTimer = setTimeout(() => {
      layoutSaveTimer = null;
      window.api.saveWindowState(projectState.folderPath, $state.snapshot(layout));
    }, 1000);
  }

  $effect(() => {
    // Track all layout fields to trigger on any change
    JSON.stringify(layout);
    if (projectState.isOpen) scheduleLayoutSave();
  });

  $effect(() => {
    // Expose the custom titlebar's height to CSS so modals can offset below it.
    document.documentElement.style.setProperty(
      '--titlebar-height',
      customTitlebar ? '32px' : '0px'
    );
  });

  onMount(() => {
    // themeState.init() runs at module scope in main.js before mount — don't repeat here.

    if (window.api?.getUIPrefs) {
      window.api.getUIPrefs().then((prefs) => {
        customTitlebar = !!prefs?.customTitlebar;
      }).catch(() => {});
    }

    function handleKeydown(e) {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleNewFile();
      } else if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        handleDeleteFile();
      } else if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        handleOpenFolder();
      } else if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        handleTogglePreview();
      } else if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        if (projectState.isOpen) handleToggleHistory();
      } else if (e.ctrlKey && e.shiftKey && e.code === 'Comma') {
        e.preventDefault();
        showProjectSettings = true;
        projectSettingsRequired = false;
      } else if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        showSettings = true;
      } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyS') {
        e.preventDefault();
        if (projectState.isOpen) showSync = true;
      } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyO') {
        e.preventDefault();
        if (projectState.isOpen) handleToggleOutline();
      } else if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        if (projectState.isOpen && projectState.selectedFileId) {
          tagAction = { type: 'add', ts: Date.now() };
        }
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        if (projectState.isOpen && projectState.selectedFileId) {
          tagAction = { type: 'remove', ts: Date.now() };
        }
      } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyT') {
        e.preventDefault();
        if (projectState.isOpen) handleToggleTags();
      } else if (e.ctrlKey && e.key === 'g') {
        e.preventDefault();
        if (projectState.isOpen) handleToggleTagGroups();
      } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyE') {
        e.preventDefault();
        handleToggleToolbar();
      } else if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        if (projectState.isOpen) handleToggleSidebar();
      } else if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        handleToggleLog();
      } else if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        handleToggleAttachments();
      } else if (e.ctrlKey && !e.shiftKey && e.key === 'f') {
        e.preventDefault();
        if (projectState.isOpen) handleToggleSearch();
      } else if (e.ctrlKey && e.key === 'PageUp') {
        e.preventDefault();
        if (projectState.isOpen) projectState.selectPrevFile();
      } else if (e.ctrlKey && e.key === 'PageDown') {
        e.preventDefault();
        if (projectState.isOpen) projectState.selectNextFile();
      } else if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();
        showAbout = true;
      } else if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        themeState.zoomIn();
      } else if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        themeState.zoomOut();
      } else if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        themeState.zoomReset();
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

  async function loadProject(folderPath, result) {
    if (result.status === 'loaded') {
      projectState.load(folderPath, result.index);
      window.api.addRecentProject(folderPath);

      // Restore saved layout
      const saved = await window.api.getWindowState(folderPath);
      if (saved) {
        layout = { ...DEFAULT_LAYOUT, ...saved };
      } else {
        layout = { ...DEFAULT_LAYOUT };
      }
      layout.paneOrder = normalizePaneOrder(layout.paneOrder);

      // Restore window bounds
      window.api.restoreWindowBounds(folderPath);

      if (result.needsGitConfig) {
        projectSettingsRequired = true;
        showProjectSettings = true;
      }
    }
  }

  async function handleOpenFolder() {
    const folderPath = await window.api.openFolderDialog();
    if (!folderPath) return;

    const result = await window.api.openProject(folderPath);
    if (result.status === 'loaded') {
      loadProject(folderPath, result);
    } else if (result.status === 'needs_setup') {
      setupFolderPath = folderPath;
      showSetup = true;
    }
  }

  async function handleOpenRecent(folderPath) {
    const result = await window.api.openProject(folderPath);
    if (result.status === 'loaded') {
      loadProject(folderPath, result);
    } else if (result.status === 'needs_setup') {
      setupFolderPath = folderPath;
      showSetup = true;
    }
  }

  async function handleSetupComplete(remoteUrl) {
    showSetup = false;
    const result = await window.api.initProject(setupFolderPath, remoteUrl);
    if (result.status === 'loaded') {
      loadProject(setupFolderPath, result);
    }
  }

  async function handleNewProjectConfirm({ folderPath, name, email }) {
    showNewProject = false;
    const result = await window.api.initProject(folderPath, '');
    if (result.status === 'loaded') {
      await window.api.setGitConfig(name, email);
      projectState.load(folderPath, result.index);
      window.api.addRecentProject(folderPath);
    }
  }

  function handleNewFile() {
    if (!projectState.isOpen) return;
    showNewFile = true;
  }

  async function handleNewFileConfirm({ name, tags }) {
    showNewFile = false;
    const entry = await window.api.createFile(name, tags);
    projectState.addFile(entry);
    projectState.selectFile(entry.id);
  }

  function handleDeleteFile() {
    if (!projectState.isOpen || !projectState.selectedFileId) return;
    showDeleteFile = true;
  }

  async function handleDeleteFileConfirm() {
    const fileId = projectState.selectedFileId;
    showDeleteFile = false;
    if (!fileId) return;
    await window.api.deleteFile(fileId);
    projectState.removeFile(fileId);
  }

  function handleToggleLog() {
    layout.showLog = !layout.showLog;
  }

  function handleTogglePreview() {
    layout.showPreview = !layout.showPreview;
  }

  function handleToggleHistory() {
    layout.showHistory = !layout.showHistory;
  }

  async function handleSaveToHtml() {
    const file = projectState.selectedFile;
    if (!file) return;
    const result = await window.api.convertToHtml(file.filename, file.name);
    if (result) {
      window.api.openPath(result.downloadsDir);
    }
  }

  function handleToggleSidebar() {
    layout.showSidebar = !layout.showSidebar;
  }

  function handleToggleToolbar() {
    layout.showToolbar = !layout.showToolbar;
  }

  function handleToggleOutline() {
    layout.showOutline = !layout.showOutline;
  }

  function handleToggleTags() {
    layout.showTags = !layout.showTags;
  }

  function handleToggleTagGroups() {
    layout.showTagGroups = !layout.showTagGroups;
  }

  function handleToggleAttachments() {
    layout.showAttachments = !layout.showAttachments;
  }

  function handleToggleSearch() {
    layout.showSearch = !layout.showSearch;
    if (layout.showSearch) {
      searchFocusTs = Date.now();
    }
  }

  function handlePaneResize(paneName, value) {
    layout[paneName] = value;
  }

  function handlePaneReorder(newOrder) {
    layout.paneOrder = normalizePaneOrder(newOrder);
  }

  function triggerTagAction(type) {
    tagAction = { type, ts: Date.now() };
  }

  function handleShowAbout() {
    showAbout = true;
  }

  function handleShowHelp() {
    // TODO: implement help
  }

  function handleShowSettings() {
    showSettings = true;
  }

  function handleShowProjectSettings() {
    projectSettingsRequired = false;
    showProjectSettings = true;
  }

  function handleShowSync() {
    showSync = true;
  }

  async function handleGoHome() {
    if (!projectState.isOpen) return;

    // Save layout before closing
    if (layoutSaveTimer) {
      clearTimeout(layoutSaveTimer);
      layoutSaveTimer = null;
      await window.api.saveWindowState(projectState.folderPath, $state.snapshot(layout));
    }

    // Show syncing modal, flush pending push, then close
    showSyncing = true;
    try {
      await window.api.closeProject();
    } finally {
      showSyncing = false;
    }
    projectState.close();
    layout = { ...DEFAULT_LAYOUT };
  }

  async function handleContextAction(action, file) {
    switch (action) {
      case 'openInFileSystem':
        if (projectState.folderPath) {
          window.api.openPath(projectState.folderPath);
        }
        break;
      case 'delete':
        projectState.selectFile(file.id);
        showDeleteFile = true;
        break;
      case 'clearTags':
        if (file.tags && file.tags.length > 0) {
          clearTagsFile = file;
          showClearTags = true;
        }
        break;
      case 'preview':
        handleTogglePreview();
        break;
      case 'convertToHtml':
        handleSaveToHtml();
        break;
    }
  }

  async function handleClearTagsConfirm() {
    const file = clearTagsFile;
    showClearTags = false;
    clearTagsFile = null;
    if (!file) return;
    const storeFile = projectState.index.files.find(f => f.id === file.id);
    if (storeFile) {
      storeFile.tags = [];
      await window.api.saveIndex($state.snapshot(projectState.index));
    }
  }
</script>

{#if showAbout}
  <AboutModal onClose={() => showAbout = false} />
{/if}

{#if showSetup}
  <SetupModal
    folderPath={setupFolderPath}
    onSetup={handleSetupComplete}
    onCancel={() => showSetup = false}
  />
{/if}

{#if showSettings}
  <SettingsModal onClose={() => showSettings = false} />
{/if}

{#if showNewProject}
  <NewProjectModal
    onConfirm={handleNewProjectConfirm}
    onCancel={() => showNewProject = false}
  />
{/if}

{#if showNewFile}
  <NewFileModal
    onConfirm={handleNewFileConfirm}
    onCancel={() => showNewFile = false}
  />
{/if}

{#if showDeleteFile && projectState.selectedFile}
  <DeleteFileModal
    fileName={projectState.selectedFile.name}
    onConfirm={handleDeleteFileConfirm}
    onCancel={() => showDeleteFile = false}
  />
{/if}

{#if showClearTags && clearTagsFile}
  <ClearTagsModal
    fileName={clearTagsFile.name}
    tagCount={clearTagsFile.tags ? clearTagsFile.tags.length : 0}
    onConfirm={handleClearTagsConfirm}
    onCancel={() => { showClearTags = false; clearTagsFile = null; }}
  />
{/if}

{#if showProjectSettings}
  <ProjectSettingsModal
    required={projectSettingsRequired}
    onClose={() => { showProjectSettings = false; projectSettingsRequired = false; }}
  />
{/if}

{#if showSync}
  <SyncModal onClose={() => showSync = false} />
{/if}

{#if showSyncing}
  <SyncingModal />
{/if}

<div class="app-layout">
  {#if customTitlebar}
    <TitleBar
      onToggleToolbar={handleToggleToolbar}
      toolbarVisible={layout.showToolbar}
    />
  {/if}

  <div class="app-body">
    {#if layout.showToolbar}
      <Toolbar
        onGoHome={handleGoHome}
        onOpenFolder={handleOpenFolder}
        onNewFile={handleNewFile}
        onDeleteFile={handleDeleteFile}
        hasSelectedFile={!!projectState.selectedFileId}
        onToggleLog={handleToggleLog}
        onToggleSidebar={handleToggleSidebar}
        onToggleOutline={handleToggleOutline}
        onToggleTags={handleToggleTags}
        onToggleTagGroups={handleToggleTagGroups}
        onToggleAttachments={handleToggleAttachments}
        onToggleSearch={handleToggleSearch}
        onShowAbout={handleShowAbout}
        onShowHelp={handleShowHelp}
        onShowSettings={handleShowSettings}
        onShowProjectSettings={handleShowProjectSettings}
        onShowSync={handleShowSync}
        projectOpen={projectState.isOpen}
        logVisible={layout.showLog}
        sidebarVisible={layout.showSidebar}
        outlineVisible={layout.showOutline}
        tagsVisible={layout.showTags}
        tagGroupsVisible={layout.showTagGroups}
        attachmentsVisible={layout.showAttachments}
        searchVisible={layout.showSearch}
      />
    {/if}

  {#if !projectState.isOpen}
    <div class="main-area">
      <OpenScreen
        onOpenFolder={handleOpenFolder}
        onNewProject={() => showNewProject = true}
        onOpenRecent={handleOpenRecent}
      />
    </div>
  {:else}
    <div class="main-area">
      <div class="content-area" class:with-log={layout.showLog}>
        {#if layout.showSidebar || layout.showOutline || layout.showTags || layout.showTagGroups || layout.showSearch}
          <div class="sidebar" style="width: {layout.sidebarWidth}px">
            <Sidebar
              {tagAction}
              filesVisible={layout.showSidebar}
              outlineVisible={layout.showOutline}
              tagsVisible={layout.showTags}
              tagGroupsVisible={layout.showTagGroups}
              searchVisible={layout.showSearch}
              searchFocusRequest={searchFocusTs}
              tagGroupsHeight={layout.tagGroupsHeight}
              outlineHeight={layout.outlineHeight}
              tagsHeight={layout.tagsHeight}
              searchHeight={layout.searchHeight}
              filesHeight={layout.filesHeight}
              paneOrder={layout.paneOrder}
              onPaneResize={handlePaneResize}
              onPaneReorder={handlePaneReorder}
              onContextAction={handleContextAction}
              onTagAction={triggerTagAction}
            />
          </div>
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <div class="resizer sidebar-resizer" role="separator" aria-orientation="vertical" tabindex="-1" onmousedown={(e) => {
            const startX = e.clientX;
            const startWidth = layout.sidebarWidth;
            const onMouseMove = (e) => {
              layout.sidebarWidth = Math.max(180, Math.min(500, startWidth + e.clientX - startX));
            };
            const onMouseUp = () => {
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          }}></div>
        {/if}
        <div class="editor-area">
          <Editor onTogglePreview={handleTogglePreview} showPreview={layout.showPreview} onToggleHistory={handleToggleHistory} showHistory={layout.showHistory} onGitConfigRequired={() => { projectSettingsRequired = true; showProjectSettings = true; }} />
        </div>
        {#if layout.showHistory}
          <div class="resizer history-resizer"></div>
          <div class="history-area">
            <HistoryPanel onClose={handleToggleHistory} />
          </div>
        {/if}
        {#if layout.showPreview}
          <div class="resizer preview-resizer"></div>
          <div class="preview-area">
            <Preview onClose={handleTogglePreview} onSaveToHtml={handleSaveToHtml} />
          </div>
        {/if}
        {#if layout.showAttachments}
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <div class="resizer attachment-resizer" role="separator" aria-orientation="vertical" tabindex="-1" onmousedown={(e) => {
            const startX = e.clientX;
            const startWidth = layout.attachmentPanelWidth;
            const onMouseMove = (e) => {
              layout.attachmentPanelWidth = Math.max(160, Math.min(400, startWidth - (e.clientX - startX)));
            };
            const onMouseUp = () => {
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          }}></div>
          <div class="attachment-area" style="width: {layout.attachmentPanelWidth}px">
            <AttachmentPanel onClose={handleToggleAttachments} />
          </div>
        {/if}
      </div>
      {#if layout.showLog}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div class="log-resizer" role="separator" aria-orientation="horizontal" tabindex="-1" onmousedown={(e) => {
          const startY = e.clientY;
          const startHeight = layout.logPanelHeight;
          const onMouseMove = (e) => {
            layout.logPanelHeight = Math.max(20, Math.min(500, startHeight - (e.clientY - startY)));
          };
          const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
          };
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
        }}></div>
        <div class="log-area" style="height: {layout.logPanelHeight}px">
          <LogPanel />
        </div>
      {/if}
    </div>
  {/if}
  </div>
</div>

<style>
  .app-layout {
    display: flex;
    flex-direction: column;
    zoom: var(--ui-zoom, 1);
    height: var(--ui-zoom-height, 100vh);
    width: var(--ui-zoom-width, 100vw);
    overflow: hidden;
  }

  .app-body {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .content-area {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .content-area.with-log {
    flex: 1;
  }

  .sidebar {
    flex-shrink: 0;
    overflow-y: auto;
    background: var(--bg-surface);
    border-right: 1px solid var(--border);
  }

  .editor-area {
    flex: 1;
    overflow: hidden;
    min-width: 200px;
  }

  .preview-area {
    flex: 1;
    overflow-y: auto;
    background: var(--bg-surface);
    border-left: 1px solid var(--border);
    max-width: 50%;
  }

  .history-area {
    flex: 1;
    overflow: hidden;
    background: var(--bg-surface);
    border-left: 1px solid var(--border);
    max-width: 50%;
  }

  .resizer {
    width: 4px;
    cursor: col-resize;
    background: var(--border);
    flex-shrink: 0;
  }

  .resizer:hover {
    background: var(--border-hover);
  }

  .log-resizer {
    height: 4px;
    cursor: row-resize;
    background: var(--border);
    flex-shrink: 0;
  }

  .log-resizer:hover {
    background: var(--border-hover);
  }

  .attachment-area {
    flex-shrink: 0;
    overflow: hidden;
    border-left: 1px solid var(--border);
  }

  .log-area {
    flex-shrink: 0;
    overflow: hidden;
    border-top: 1px solid var(--border);
  }
</style>

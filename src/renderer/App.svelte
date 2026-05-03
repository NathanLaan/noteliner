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
  import ImportingModal from './components/ImportingModal.svelte';
  import HistoryPanel from './components/HistoryPanel.svelte';
  import AttachmentPanel from './components/AttachmentPanel.svelte';
  import CommandPalette from './components/CommandPalette.svelte';
  import { projectState } from './stores/project.svelte.js';
  import { themeState } from './stores/theme.svelte.js';
  import { logState } from './stores/log.svelte.js';
  import { commandRegistry } from './stores/commands.svelte.js';
  import { installTestHelpers } from './test-helpers.js';

  const VALID_PANE_KEYS = ['files', 'tagGroups', 'outline', 'tags', 'search', 'backlinks'];

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
    showBacklinks: false,
    sidebarWidth: 260,
    logPanelHeight: 300,
    attachmentPanelWidth: 220,
    previewWidth: 500,
    filesHeight: 200,
    tagGroupsHeight: 150,
    outlineHeight: 150,
    tagsHeight: 100,
    searchHeight: 200,
    backlinksHeight: 180,
    paneOrder: ['files', 'tagGroups', 'outline', 'tags', 'search', 'backlinks'],
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
  let showImporting = $state(false);
  let importingFilename = $state('');
  let showClearTags = $state(false);
  let clearTagsFile = $state(null);
  let projectSettingsRequired = $state(false);
  let tagAction = $state(null);
  let searchFocusTs = $state(null);
  let setupFolderPath = $state('');
  let customTitlebar = $state(false);
  let showPalette = $state(false);

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

  function registerCommands() {
    const C = (def) => commandRegistry.register(def);
    const ctrl = (e) => e.ctrlKey || e.metaKey;
    const projectOpen = () => projectState.isOpen;
    const hasSelection = () => projectState.isOpen && !!projectState.selectedFileId;

    // File
    C({ id: 'file.new', label: 'New File', section: 'File', shortcut: 'Ctrl+N',
        matches: (e) => ctrl(e) && !e.shiftKey && !e.altKey && e.key === 'n',
        when: projectOpen, run: () => handleNewFile() });
    C({ id: 'file.delete', label: 'Delete File', section: 'File', shortcut: 'Ctrl+D',
        matches: (e) => ctrl(e) && !e.shiftKey && !e.altKey && e.key === 'd',
        when: hasSelection, run: () => handleDeleteFile() });
    C({ id: 'file.import', label: 'Import Document', section: 'File', shortcut: 'Ctrl+Shift+I',
        matches: (e) => ctrl(e) && e.shiftKey && !e.altKey && e.code === 'KeyI',
        when: projectOpen, run: () => handleImportDocument() });
    C({ id: 'file.openFolder', label: 'Open Folder', section: 'File', shortcut: 'Ctrl+O',
        matches: (e) => ctrl(e) && !e.shiftKey && !e.altKey && e.key === 'o',
        run: () => handleOpenFolder() });
    C({ id: 'file.prev', label: 'Previous File', section: 'File', shortcut: 'Ctrl+PgUp',
        matches: (e) => ctrl(e) && !e.altKey && e.key === 'PageUp',
        when: projectOpen, run: () => projectState.selectPrevFile() });
    C({ id: 'file.next', label: 'Next File', section: 'File', shortcut: 'Ctrl+PgDn',
        matches: (e) => ctrl(e) && !e.altKey && e.key === 'PageDown',
        when: projectOpen, run: () => projectState.selectNextFile() });

    // View
    C({ id: 'view.togglePreview', label: 'Toggle Preview', section: 'View', shortcut: 'Ctrl+P',
        matches: (e) => ctrl(e) && !e.shiftKey && !e.altKey && e.key === 'p',
        run: () => handleTogglePreview() });
    C({ id: 'view.toggleHistory', label: 'Toggle History', section: 'View', shortcut: 'Ctrl+H',
        matches: (e) => ctrl(e) && !e.shiftKey && !e.altKey && e.key === 'h',
        when: projectOpen, run: () => handleToggleHistory() });
    C({ id: 'view.toggleSidebar', label: 'Toggle Files Panel', section: 'View', shortcut: 'Ctrl+E',
        matches: (e) => ctrl(e) && !e.shiftKey && !e.altKey && e.key === 'e',
        when: projectOpen, run: () => handleToggleSidebar() });
    C({ id: 'view.toggleToolbar', label: 'Toggle Toolbar', section: 'View', shortcut: 'Ctrl+Shift+E',
        matches: (e) => ctrl(e) && e.shiftKey && !e.altKey && e.code === 'KeyE',
        run: () => handleToggleToolbar() });
    C({ id: 'view.toggleOutline', label: 'Toggle Outline', section: 'View', shortcut: 'Ctrl+Shift+O',
        matches: (e) => ctrl(e) && e.shiftKey && !e.altKey && e.code === 'KeyO',
        when: projectOpen, run: () => handleToggleOutline() });
    C({ id: 'view.toggleTags', label: 'Toggle Tags', section: 'View', shortcut: 'Ctrl+Shift+T',
        matches: (e) => ctrl(e) && e.shiftKey && !e.altKey && e.code === 'KeyT',
        when: projectOpen, run: () => handleToggleTags() });
    C({ id: 'view.toggleTagGroups', label: 'Toggle Tag Groups', section: 'View', shortcut: 'Ctrl+G',
        matches: (e) => ctrl(e) && !e.shiftKey && !e.altKey && e.key === 'g',
        when: projectOpen, run: () => handleToggleTagGroups() });
    C({ id: 'view.toggleAttachments', label: 'Toggle Attachments', section: 'View', shortcut: 'Ctrl+B',
        matches: (e) => ctrl(e) && !e.shiftKey && !e.altKey && e.key === 'b',
        run: () => handleToggleAttachments() });
    C({ id: 'view.toggleSearch', label: 'Toggle Search', section: 'View', shortcut: 'Ctrl+F',
        matches: (e) => ctrl(e) && !e.shiftKey && !e.altKey && e.key === 'f',
        when: projectOpen, run: () => handleToggleSearch() });
    C({ id: 'view.toggleBacklinks', label: 'Toggle Backlinks', section: 'View', shortcut: 'Ctrl+Shift+B',
        matches: (e) => ctrl(e) && e.shiftKey && !e.altKey && e.code === 'KeyB',
        when: projectOpen, run: () => handleToggleBacklinks() });
    C({ id: 'view.toggleLog', label: 'Toggle Log Panel', section: 'View', shortcut: 'Ctrl+L',
        matches: (e) => ctrl(e) && !e.shiftKey && !e.altKey && e.key === 'l',
        run: () => handleToggleLog() });
    C({ id: 'view.zoomIn', label: 'Zoom In', section: 'View', shortcut: 'Ctrl+=',
        matches: (e) => ctrl(e) && !e.altKey && (e.key === '=' || e.key === '+'),
        run: () => themeState.zoomIn() });
    C({ id: 'view.zoomOut', label: 'Zoom Out', section: 'View', shortcut: 'Ctrl+-',
        matches: (e) => ctrl(e) && !e.altKey && e.key === '-',
        run: () => themeState.zoomOut() });
    C({ id: 'view.zoomReset', label: 'Zoom Reset', section: 'View', shortcut: 'Ctrl+0',
        matches: (e) => ctrl(e) && !e.altKey && e.key === '0',
        run: () => themeState.zoomReset() });

    // Tags
    C({ id: 'tag.add', label: 'Add Tag', section: 'Tags', shortcut: 'Ctrl+T',
        matches: (e) => ctrl(e) && !e.shiftKey && !e.altKey && e.key === 't',
        when: hasSelection, run: () => triggerTagAction('add') });
    C({ id: 'tag.remove', label: 'Remove Tag', section: 'Tags', shortcut: 'Ctrl+Y',
        matches: (e) => ctrl(e) && !e.shiftKey && !e.altKey && e.key === 'y',
        when: hasSelection, run: () => triggerTagAction('remove') });

    // Project
    C({ id: 'project.sync', label: 'Remote Sync', section: 'Project', shortcut: 'Ctrl+Shift+S',
        matches: (e) => ctrl(e) && e.shiftKey && !e.altKey && e.code === 'KeyS',
        when: projectOpen, run: () => handleShowSync() });
    C({ id: 'project.settings', label: 'Project Settings', section: 'Project', shortcut: 'Ctrl+Shift+,',
        matches: (e) => ctrl(e) && e.shiftKey && !e.altKey && e.code === 'Comma',
        when: projectOpen, run: () => handleShowProjectSettings() });
    C({ id: 'project.goHome', label: 'Close Project (Home)', section: 'Project',
        when: projectOpen, run: () => handleGoHome() });

    // Theme — palette-only; no shortcuts.
    C({ id: 'theme.midnight', label: 'Set Theme: Midnight', section: 'Theme',
        run: () => themeState.set('midnight') });
    C({ id: 'theme.dark', label: 'Set Theme: Dark', section: 'Theme',
        run: () => themeState.set('dark') });
    C({ id: 'theme.light', label: 'Set Theme: Light', section: 'Theme',
        run: () => themeState.set('light') });

    // App
    C({ id: 'app.settings', label: 'Settings', section: 'App', shortcut: 'Ctrl+,',
        matches: (e) => ctrl(e) && !e.shiftKey && !e.altKey && e.key === ',',
        run: () => handleShowSettings() });
    C({ id: 'app.about', label: 'About', section: 'App', shortcut: 'Ctrl+I',
        matches: (e) => ctrl(e) && !e.shiftKey && !e.altKey && e.key === 'i',
        run: () => handleShowAbout() });
    C({ id: 'app.commandPalette', label: 'Command Palette', section: 'App', shortcut: 'Ctrl+K',
        matches: (e) => ctrl(e) && !e.altKey
          && ((!e.shiftKey && (e.key === 'k' || e.key === 'K')) || (e.shiftKey && e.code === 'KeyP')),
        run: () => { showPalette = true; } });
  }

  // Persist recently-used command ids back to ui-preferences (debounced).
  let recentsSaveTimer = null;
  $effect(() => {
    const ids = commandRegistry.recentIds;
    if (!recentsLoaded) return;
    if (recentsSaveTimer) clearTimeout(recentsSaveTimer);
    recentsSaveTimer = setTimeout(() => {
      recentsSaveTimer = null;
      window.api?.setUIPrefs?.({ commandRecents: $state.snapshot(ids) }).catch(() => {});
    }, 500);
  });
  let recentsLoaded = $state(false);

  onMount(() => {
    // themeState.init() runs at module scope in main.js before mount — don't repeat here.

    installTestHelpers(projectState);
    registerCommands();

    if (window.api?.getUIPrefs) {
      window.api.getUIPrefs().then((prefs) => {
        customTitlebar = !!prefs?.customTitlebar;
        commandRegistry.loadRecents(prefs?.commandRecents || []);
      }).catch(() => {}).finally(() => {
        recentsLoaded = true;
      });
    } else {
      recentsLoaded = true;
    }

    function handleKeydown(e) {
      // Palette gets all keystrokes when open; don't dispatch shortcuts past it.
      if (showPalette) return;
      commandRegistry.dispatchKeyEvent(e);
    }

    // Capture phase so Ctrl+K reaches us before CodeMirror's "delete-to-EOL" binding.
    window.addEventListener('keydown', handleKeydown, true);
    return () => window.removeEventListener('keydown', handleKeydown, true);
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
    createFromWikilinkName = '';
    const entry = await window.api.createFile(name, tags);
    projectState.addFile(entry);
    projectState.selectFile(entry.id);
  }

  function handleDeleteFile() {
    if (!projectState.isOpen || !projectState.selectedFileId) return;
    showDeleteFile = true;
  }

  async function handleImportDocument() {
    if (!projectState.isOpen) return;
    const sourcePath = await window.api.openImportDialog();
    if (!sourcePath) return;

    const basename = sourcePath.split(/[\\/]/).pop();
    importingFilename = basename;
    showImporting = true;

    try {
      const result = await window.api.importDocument(sourcePath);
      if (result?.error) {
        logState.add(`Import failed: ${result.error}`);
        return;
      }
      const { entry, stats } = result;
      projectState.addFile(entry);
      // selectFile reads the file and sets editorContent to the converted body.
      projectState.selectFile(entry.id);

      const parts = [`Imported ${basename}`];
      if (stats.images) parts.push(`${stats.images} image${stats.images === 1 ? '' : 's'}`);
      if (stats.tablesStripped) parts.push(`${stats.tablesStripped} table${stats.tablesStripped === 1 ? '' : 's'} stripped`);
      logState.add(parts.join(' — '));
      for (const w of stats.warnings || []) {
        logState.add(`Import warning: ${w}`);
      }
    } catch (err) {
      logState.add(`Import failed: ${err.message}`);
    } finally {
      showImporting = false;
      importingFilename = '';
    }
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

  async function handleSaveToPdf() {
    const file = projectState.selectedFile;
    if (!file) return;
    const result = await window.api.convertToPdf(file.filename, file.name);
    if (result) {
      window.api.openPath(result.downloadsDir);
    }
  }

  async function handleSaveToMarkdown() {
    const file = projectState.selectedFile;
    if (!file) return;
    const result = await window.api.convertToMarkdown(file.filename, file.name);
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

  function handleToggleBacklinks() {
    layout.showBacklinks = !layout.showBacklinks;
  }

  async function handleBacklinkSelect(sourceId, line) {
    await projectState.selectFile(sourceId);
    if (typeof line === 'number') {
      projectState.scrollToLine = { line, ts: Date.now() };
    }
  }

  let createFromWikilinkName = $state('');

  function handleCreateFromWikilink(name) {
    createFromWikilinkName = name;
    showNewFile = true;
  }

  function handleToggleSearch() {
    layout.showSearch = !layout.showSearch;
    if (layout.showSearch) {
      searchFocusTs = Date.now();
    }
  }

  function handleClosePane(paneKey) {
    switch (paneKey) {
      case 'files': layout.showSidebar = false; break;
      case 'outline': layout.showOutline = false; break;
      case 'tags': layout.showTags = false; break;
      case 'tagGroups': layout.showTagGroups = false; break;
      case 'search': layout.showSearch = false; break;
      case 'backlinks': layout.showBacklinks = false; break;
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
      case 'convertToPdf':
        handleSaveToPdf();
        break;
      case 'convertToMarkdown':
        handleSaveToMarkdown();
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

{#if showPalette}
  <CommandPalette
    onClose={() => showPalette = false}
    onOpenRecent={async (path) => { showPalette = false; await handleOpenRecent(path); }}
  />
{/if}

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
    initialName={createFromWikilinkName}
    onConfirm={handleNewFileConfirm}
    onCancel={() => { showNewFile = false; createFromWikilinkName = ''; }}
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

{#if showImporting}
  <ImportingModal filename={importingFilename} />
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
        onImportDocument={handleImportDocument}
        hasSelectedFile={!!projectState.selectedFileId}
        onToggleLog={handleToggleLog}
        onToggleSidebar={handleToggleSidebar}
        onToggleOutline={handleToggleOutline}
        onToggleTags={handleToggleTags}
        onToggleTagGroups={handleToggleTagGroups}
        onToggleAttachments={handleToggleAttachments}
        onToggleSearch={handleToggleSearch}
        onToggleBacklinks={handleToggleBacklinks}
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
        backlinksVisible={layout.showBacklinks}
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
        {#if layout.showSidebar || layout.showOutline || layout.showTags || layout.showTagGroups || layout.showSearch || layout.showBacklinks}
          <div class="sidebar" style="width: {layout.sidebarWidth}px">
            <Sidebar
              {tagAction}
              filesVisible={layout.showSidebar}
              outlineVisible={layout.showOutline}
              tagsVisible={layout.showTags}
              tagGroupsVisible={layout.showTagGroups}
              searchVisible={layout.showSearch}
              backlinksVisible={layout.showBacklinks}
              searchFocusRequest={searchFocusTs}
              tagGroupsHeight={layout.tagGroupsHeight}
              outlineHeight={layout.outlineHeight}
              tagsHeight={layout.tagsHeight}
              searchHeight={layout.searchHeight}
              backlinksHeight={layout.backlinksHeight}
              filesHeight={layout.filesHeight}
              paneOrder={layout.paneOrder}
              onPaneResize={handlePaneResize}
              onPaneReorder={handlePaneReorder}
              onContextAction={handleContextAction}
              onTagAction={triggerTagAction}
              onClosePane={handleClosePane}
              onBacklinkSelect={handleBacklinkSelect}
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
          <Editor onTogglePreview={handleTogglePreview} showPreview={layout.showPreview} onToggleHistory={handleToggleHistory} showHistory={layout.showHistory} onGitConfigRequired={() => { projectSettingsRequired = true; showProjectSettings = true; }} onSaveToHtml={handleSaveToHtml} onSaveToPdf={handleSaveToPdf} onSaveToMarkdown={handleSaveToMarkdown} />
        </div>
        {#if layout.showHistory}
          <div class="resizer history-resizer"></div>
          <div class="history-area">
            <HistoryPanel onClose={handleToggleHistory} />
          </div>
        {/if}
        {#if layout.showPreview}
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <div class="resizer preview-resizer" role="separator" aria-orientation="vertical" tabindex="-1" onmousedown={(e) => {
            const startX = e.clientX;
            const startWidth = layout.previewWidth;
            const onMouseMove = (e) => {
              layout.previewWidth = Math.max(200, Math.min(1600, startWidth - (e.clientX - startX)));
            };
            const onMouseUp = () => {
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          }}></div>
          <div class="preview-area" style="width: {layout.previewWidth}px">
            <Preview onClose={handleTogglePreview} onSaveToHtml={handleSaveToHtml} onSaveToPdf={handleSaveToPdf} onSaveToMarkdown={handleSaveToMarkdown} onCreateFromWikilink={handleCreateFromWikilink} />
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
          <LogPanel onClose={handleToggleLog} />
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
    min-width: 160px;
  }

  .preview-area {
    flex-shrink: 0;
    overflow-y: auto;
    background: var(--bg-surface);
    border-left: 1px solid var(--border);
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

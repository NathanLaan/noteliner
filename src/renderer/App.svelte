<script>
  import { onMount } from 'svelte';
  import Toolbar from './components/Toolbar.svelte';
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
  import AttachmentPanel from './components/AttachmentPanel.svelte';
  import { projectState } from './stores/project.svelte.js';
  import { themeState } from './stores/theme.svelte.js';

  let showPreview = $state(false);
  let showLog = $state(false);
  let showAttachments = $state(false);
  let logPanelHeight = $state(300);
  let showAbout = $state(false);
  let showSetup = $state(false);
  let showSettings = $state(false);
  let showProjectSettings = $state(false);
  let showNewProject = $state(false);
  let projectSettingsRequired = $state(false);
  let setupFolderPath = $state('');
  let sidebarWidth = $state(260);
  let attachmentPanelWidth = $state(220);

  onMount(() => {
    themeState.init();

    function handleKeydown(e) {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleNewFile();
      } else if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        handleOpenFolder();
      } else if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        handleTogglePreview();
      } else if (e.ctrlKey && e.shiftKey && e.code === 'Comma') {
        e.preventDefault();
        showProjectSettings = true;
        projectSettingsRequired = false;
      } else if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        showSettings = true;
      } else if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        handleToggleLog();
      } else if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        handleToggleAttachments();
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

  function loadProject(folderPath, result) {
    if (result.status === 'loaded') {
      projectState.load(folderPath, result.index);
      window.api.addRecentProject(folderPath);
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

  async function handleNewFile() {
    if (!projectState.isOpen) return;

    const name = 'Untitled';
    const entry = await window.api.createFile(name);
    projectState.addFile(entry);
    projectState.selectFile(entry.id);
  }

  function handleToggleLog() {
    showLog = !showLog;
  }

  function handleTogglePreview() {
    showPreview = !showPreview;
  }

  function handleToggleAttachments() {
    showAttachments = !showAttachments;
  }

  function handleShowAbout() {
    showAbout = true;
  }

  function handleShowSettings() {
    showSettings = true;
  }

  function handleShowProjectSettings() {
    projectSettingsRequired = false;
    showProjectSettings = true;
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

{#if showProjectSettings}
  <ProjectSettingsModal
    required={projectSettingsRequired}
    onClose={() => { showProjectSettings = false; projectSettingsRequired = false; }}
  />
{/if}

<div class="app-layout">
  <Toolbar
    onOpenFolder={handleOpenFolder}
    onNewFile={handleNewFile}
    onToggleLog={handleToggleLog}
    onToggleAttachments={handleToggleAttachments}
    onShowAbout={handleShowAbout}
    onShowSettings={handleShowSettings}
    onShowProjectSettings={handleShowProjectSettings}
    projectOpen={projectState.isOpen}
    logVisible={showLog}
    attachmentsVisible={showAttachments}
  />

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
      <div class="content-area" class:with-log={showLog}>
        <div class="sidebar" style="width: {sidebarWidth}px">
          <Sidebar
            bind:width={sidebarWidth}
          />
        </div>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div class="resizer sidebar-resizer" role="separator" aria-orientation="vertical" tabindex="-1" onmousedown={(e) => {
          const startX = e.clientX;
          const startWidth = sidebarWidth;
          const onMouseMove = (e) => {
            sidebarWidth = Math.max(180, Math.min(500, startWidth + e.clientX - startX));
          };
          const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
          };
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
        }}></div>
        <div class="editor-area">
          <Editor onTogglePreview={handleTogglePreview} showPreview={showPreview} onGitConfigRequired={() => { projectSettingsRequired = true; showProjectSettings = true; }} />
        </div>
        {#if showPreview}
          <div class="resizer preview-resizer"></div>
          <div class="preview-area">
            <Preview onClose={handleTogglePreview} />
          </div>
        {/if}
        {#if showAttachments}
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <div class="resizer attachment-resizer" role="separator" aria-orientation="vertical" tabindex="-1" onmousedown={(e) => {
            const startX = e.clientX;
            const startWidth = attachmentPanelWidth;
            const onMouseMove = (e) => {
              attachmentPanelWidth = Math.max(160, Math.min(400, startWidth - (e.clientX - startX)));
            };
            const onMouseUp = () => {
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          }}></div>
          <div class="attachment-area" style="width: {attachmentPanelWidth}px">
            <AttachmentPanel />
          </div>
        {/if}
      </div>
      {#if showLog}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div class="log-resizer" role="separator" aria-orientation="horizontal" tabindex="-1" onmousedown={(e) => {
          const startY = e.clientY;
          const startHeight = logPanelHeight;
          const onMouseMove = (e) => {
            logPanelHeight = Math.max(20, Math.min(500, startHeight - (e.clientY - startY)));
          };
          const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
          };
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
        }}></div>
        <div class="log-area" style="height: {logPanelHeight}px">
          <LogPanel />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .app-layout {
    display: flex;
    zoom: var(--ui-zoom, 1);
    height: var(--ui-zoom-height, 100vh);
    width: var(--ui-zoom-width, 100vw);
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

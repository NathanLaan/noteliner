const { app, BrowserWindow, Menu, ipcMain, dialog, shell, net, protocol, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { GitService } = require('./git-service');
const { ProjectService } = require('./project-service');
const { WindowStateService } = require('./window-state-service');
const { LinkGraphService } = require('./link-graph-service');
const { ImportService } = require('./import-service');
const perf = require('./perf');
const { marked } = require('marked');

// Set app name early so Linux WM_CLASS is correct (for dock icon in dev mode)
app.setName('NoteLiner');

// Enforce single-instance — a second launch would share the userData dir
// but fail to open the LevelDB that holds localStorage (theme, scale, etc.),
// silently falling back to an empty in-memory store. Exit immediately instead.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Wayland + Vulkan is an incompatible combination in Chromium — GPU surfaces
// can't survive a screen-lock/unlock cycle, leaving a blank white screen.
// Disabling Vulkan lets Chromium fall back to OpenGL/GLES which handles
// Wayland surface lifecycle correctly.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-vulkan');
}

const RECENT_PROJECTS_FILE = 'recent-projects.json';
const UI_PREFS_FILE = 'ui-preferences.json';
const MAX_RECENT = 5;

function getUIPrefsPath() {
  return path.join(app.getPath('userData'), UI_PREFS_FILE);
}

function loadUIPrefs() {
  const defaults = { customTitlebar: false, writeFrontmatter: true };
  try {
    const filePath = getUIPrefsPath();
    if (fs.existsSync(filePath)) {
      return { ...defaults, ...JSON.parse(fs.readFileSync(filePath, 'utf-8')) };
    }
  } catch { /* ignore */ }
  return defaults;
}

function saveUIPrefs(prefs) {
  fs.writeFileSync(getUIPrefsPath(), JSON.stringify(prefs, null, 2));
}

function getRecentProjectsPath() {
  return path.join(app.getPath('userData'), RECENT_PROJECTS_FILE);
}

function loadRecentProjects() {
  try {
    const filePath = getRecentProjectsPath();
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return [];
}

function saveRecentProjects(projects) {
  fs.writeFileSync(getRecentProjectsPath(), JSON.stringify(projects, null, 2));
}

function addRecentProject(folderPath) {
  let projects = loadRecentProjects();
  projects = projects.filter(p => p.path !== folderPath);
  projects.unshift({
    path: folderPath,
    name: path.basename(folderPath),
    openedAt: new Date().toISOString()
  });
  if (projects.length > MAX_RECENT) projects = projects.slice(0, MAX_RECENT);
  saveRecentProjects(projects);
}

let mainWindow;
let gitService;
let projectService;
let linkGraphService;
let importService;
let windowStateService;
let boundsTimer = null;

const isDev = !app.isPackaged;
const isTest = process.env.NODE_ENV === 'test';

function createWindow() {
  const uiPrefs = loadUIPrefs();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    frame: !uiPrefs.customTitlebar,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  Menu.setApplicationMenu(null);

  if (isDev && !isTest) {
    mainWindow.loadURL('http://localhost:5250');
    mainWindow.webContents.on('console-message', ({ level, message }) => {
      console.log(`[Renderer ${level}] ${message}`);
    });
  } else {
    const indexFile = path.join(__dirname, '..', '..', 'dist', 'index.html');
    if (isTest) {
      mainWindow.loadFile(indexFile, { query: { test: '1' } });
      mainWindow.webContents.on('console-message', ({ level, message }) => {
        console.log(`[Renderer ${level}] ${message}`);
      });
    } else {
      mainWindow.loadFile(indexFile);
    }
  }

  gitService = new GitService((msg) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('git:log', msg);
    }
  });

  projectService = new ProjectService(gitService);
  projectService.setWriteFrontmatter(uiPrefs.writeFrontmatter !== false);
  linkGraphService = new LinkGraphService(projectService);
  importService = new ImportService(projectService);
  windowStateService = new WindowStateService(
    path.join(app.getPath('userData'), 'window-state.json')
  );

  function saveBoundsDebounced() {
    if (!projectService.projectPath || mainWindow.isMaximized()) return;
    if (boundsTimer) clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      boundsTimer = null;
      const bounds = mainWindow.getBounds();
      windowStateService.setBounds(projectService.projectPath, bounds, false);
    }, 1000);
  }

  mainWindow.on('resize', saveBoundsDebounced);
  mainWindow.on('move', saveBoundsDebounced);
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized', true);
    if (projectService.projectPath) {
      windowStateService.setBounds(projectService.projectPath, mainWindow.getNormalBounds(), true);
    }
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximized', false);
    if (projectService.projectPath) {
      const bounds = mainWindow.getBounds();
      windowStateService.setBounds(projectService.projectPath, bounds, false);
    }
  });
  mainWindow.on('close', () => {
    if (boundsTimer) clearTimeout(boundsTimer);
    if (projectService.projectPath) {
      const isMax = mainWindow.isMaximized();
      const bounds = isMax ? mainWindow.getNormalBounds() : mainWindow.getBounds();
      windowStateService.setBoundsSync(projectService.projectPath, bounds, isMax);
    }
  });

  // If the renderer crashes (e.g. GPU context lost), reload automatically
  // instead of leaving a permanent blank screen.
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.log(`Renderer process gone (reason: ${details.reason}), reloading...`);
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.reload();
    }
  });
}

app.whenReady().then(() => {
  protocol.handle('attachment', (request) => {
    if (!projectService || !projectService.projectPath) {
      return new Response('Not found', { status: 404 });
    }
    const url = new URL(request.url);
    const filename = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const filePath = path.join(projectService.projectPath, '_attachments', filename);
    return net.fetch('file://' + filePath);
  });

  createWindow();

  // Auto-update only in packaged production builds. Dev runs and the test
  // harness skip the network round-trip entirely.
  if (app.isPackaged && !isTest) {
    try {
      const { autoUpdater } = require('electron-updater');
      const log = (msg) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('git:log', `[update] ${msg}`);
        }
      };
      autoUpdater.on('checking-for-update', () => log('Checking for update...'));
      autoUpdater.on('update-available', (info) => log(`Update available: ${info?.version || ''}`));
      autoUpdater.on('update-not-available', () => log('No update available.'));
      autoUpdater.on('error', (err) => log(`Update error: ${err?.message || err}`));
      autoUpdater.on('download-progress', (p) => log(`Downloading update: ${Math.round(p.percent || 0)}%`));
      autoUpdater.on('update-downloaded', (info) => log(`Update ${info?.version || ''} ready; will install on next restart.`));
      autoUpdater.checkForUpdatesAndNotify().catch((err) => log(`Update check failed: ${err?.message || err}`));
    } catch (err) {
      // electron-updater throws if there is no publish config — non-fatal.
      console.warn('electron-updater unavailable:', err.message);
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- IPC Handlers ---

ipcMain.handle('ui:getPrefs', () => loadUIPrefs());
ipcMain.handle('ui:setPrefs', (_event, prefs) => {
  const current = loadUIPrefs();
  saveUIPrefs({ ...current, ...prefs });
  if (projectService && typeof prefs?.writeFrontmatter === 'boolean') {
    projectService.setWriteFrontmatter(prefs.writeFrontmatter);
  }
  return true;
});

// Recreate the BrowserWindow in-process instead of doing a full `app.relaunch()`.
// A real relaunch tears down the Electron child started by scripts/dev.js, which
// kills the Vite dev server with it — the relaunched instance then loads
// http://localhost:5250 and hangs on a blank page. Recreating the window picks
// up settings that are only read at construction time (e.g. `frame:` for the
// custom titlebar) without exiting the process.
ipcMain.handle('app:relaunch', () => {
  const old = mainWindow;
  if (old && !old.isDestroyed()) {
    if (boundsTimer) clearTimeout(boundsTimer);
    if (projectService?.projectPath) {
      const isMax = old.isMaximized();
      const bounds = isMax ? old.getNormalBounds() : old.getBounds();
      windowStateService.setBoundsSync(projectService.projectPath, bounds, isMax);
    }
  }
  // createWindow() reassigns `mainWindow` and the service globals; the old
  // window's listeners still close over the same `let` bindings, so they'd
  // race on the new state. Destroy the old window before its handlers can fire.
  createWindow();
  if (old && !old.isDestroyed()) {
    old.removeAllListeners('close');
    old.destroy();
  }
});

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => !!mainWindow?.isMaximized());

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('project:open', async (_event, folderPath) => {
  return perf.measure('project.open', async () => {
    const result = await projectService.openProject(folderPath);
    if (result.status === 'loaded') {
      await perf.measure('linkgraph.rebuild', () => linkGraphService.rebuild(),
        { files: projectService.index?.files?.length || 0 });
    }
    return result;
  });
});

ipcMain.handle('project:init', async (_event, folderPath, remoteUrl) => {
  const result = await projectService.initProject(folderPath, remoteUrl);
  if (result.status === 'loaded') await linkGraphService.rebuild();
  return result;
});

ipcMain.handle('project:close', async () => {
  if (!projectService.projectPath) return;
  await gitService.flushPush(projectService.projectPath);
  projectService.projectPath = null;
  projectService.index = null;
  linkGraphService.reset();
});

ipcMain.handle('project:getIndex', async () => {
  return projectService.getIndex();
});

ipcMain.handle('project:saveIndex', async (_event, index) => {
  return await projectService.saveIndex(index);
});

ipcMain.handle('file:read', async (_event, filePath) => {
  return perf.measure('file.read', () => projectService.readFile(filePath));
});

ipcMain.handle('file:write', async (_event, filePath, content) => {
  return perf.measure('file.write', async () => {
    try {
      const result = await projectService.writeFile(filePath, content);
      const entry = projectService.index?.files.find(f => f.filename === filePath);
      if (entry) await linkGraphService.scanFile(entry.id);
      return result;
    } catch (err) {
      if (err.code === 'GIT_CONFIG_REQUIRED') return { error: 'git_config_required' };
      throw err;
    }
  }, { bytes: typeof content === 'string' ? content.length : 0 });
});

ipcMain.handle('file:create', async (_event, name, tags) => {
  return perf.measure('file.create', async () => {
    try {
      const entry = await projectService.createFile(name, tags);
      // New file may resolve pre-existing dangling links elsewhere; full rebuild is cheap.
      await linkGraphService.rebuild();
      return entry;
    } catch (err) {
      if (err.code === 'GIT_CONFIG_REQUIRED') return { error: 'git_config_required' };
      throw err;
    }
  });
});

ipcMain.handle('file:delete', async (_event, fileId) => {
  try {
    const result = await projectService.deleteFile(fileId);
    linkGraphService.removeFile(fileId);
    // Re-scan sources that linked to this file so their outgoing links become dangling.
    await linkGraphService.rebuild();
    return result;
  } catch (err) {
    if (err.code === 'GIT_CONFIG_REQUIRED') return { error: 'git_config_required' };
    throw err;
  }
});

ipcMain.handle('file:rename', async (_event, fileId, newName) => {
  try {
    const entry = await projectService.renameFile(fileId, newName);
    await linkGraphService.rebuild();
    return entry;
  } catch (err) {
    if (err.code === 'GIT_CONFIG_REQUIRED') return { error: 'git_config_required' };
    throw err;
  }
});

// Import

ipcMain.handle('dialog:openImportFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Word Document', extensions: ['docx'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('file:import', async (_event, sourcePath) => {
  try {
    const result = await importService.importDocx(sourcePath);
    await linkGraphService.rebuild();
    return result;
  } catch (err) {
    if (err.code === 'GIT_CONFIG_REQUIRED') return { error: 'git_config_required' };
    return { error: err.message };
  }
});

// Link graph

ipcMain.handle('links:getBacklinks', async (_event, fileId) => {
  return perf.measure('links.backlinks', () => linkGraphService.getBacklinkSnippets(fileId));
});

ipcMain.handle('links:getAllNames', async () => {
  return linkGraphService.getAllNoteNames();
});

ipcMain.handle('links:rebuild', async () => {
  await perf.measure('linkgraph.rebuild', () => linkGraphService.rebuild(),
    { files: projectService.index?.files?.length || 0 });
});

ipcMain.handle('git:push', async () => {
  if (!projectService.projectPath) return;
  return await gitService.push(projectService.projectPath);
});

ipcMain.handle('git:pull', async () => {
  if (!projectService.projectPath) return;
  return await gitService.pull(projectService.projectPath);
});

ipcMain.handle('git:pullRebase', async () => {
  if (!projectService.projectPath) return;
  return await gitService.pullRebase(projectService.projectPath);
});

ipcMain.handle('git:getRemoteUrl', async () => {
  if (!projectService.projectPath) return null;
  return await gitService.getRemoteUrl(projectService.projectPath);
});

ipcMain.handle('git:setRemoteUrl', async (_event, url) => {
  if (!projectService.projectPath) return;
  return await gitService.setRemoteUrl(projectService.projectPath, url);
});

ipcMain.handle('git:removeRemote', async () => {
  if (!projectService.projectPath) return;
  return await gitService.removeRemote(projectService.projectPath);
});

ipcMain.handle('git:getSyncStatus', async () => {
  if (!projectService.projectPath) return { status: 'error', message: 'No project open' };
  return await gitService.getSyncStatus(projectService.projectPath);
});

ipcMain.handle('git:getBranch', async () => {
  if (!projectService.projectPath) return null;
  return await gitService.getCurrentBranch(projectService.projectPath);
});

ipcMain.handle('git:pushUpstream', async () => {
  if (!projectService.projectPath) return;
  const branch = await gitService.getCurrentBranch(projectService.projectPath);
  return await gitService.setUpstreamAndPush(projectService.projectPath, branch);
});

ipcMain.handle('git:resetToRemote', async () => {
  if (!projectService.projectPath) return null;
  const branch = await gitService.getCurrentBranch(projectService.projectPath);
  await gitService.resetToRemote(projectService.projectPath, branch);
  // Reload index since noteliner.json may have changed
  const indexPath = path.join(projectService.projectPath, 'noteliner.json');
  if (fs.existsSync(indexPath)) {
    projectService.index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  }
  return { index: projectService.index };
});

// Git config

ipcMain.handle('git:getConfig', async () => {
  return await projectService.getGitConfig();
});

ipcMain.handle('git:setConfig', async (_event, name, email) => {
  return await projectService.setGitConfig(name, email);
});

// Attachments

ipcMain.handle('file:addAttachment', async (_event, fileId, buffer, originalName) => {
  return await projectService.addAttachment(fileId, buffer, originalName);
});

ipcMain.handle('file:removeAttachment', async (_event, fileId, attachmentId) => {
  return await projectService.removeAttachment(fileId, attachmentId);
});

ipcMain.handle('file:getAttachmentPath', async (_event, filename) => {
  return projectService.getAttachmentPath(filename);
});

ipcMain.handle('dialog:openFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections']
  });
  if (result.canceled) return [];
  return result.filePaths.map(filePath => ({
    buffer: fs.readFileSync(filePath).buffer,
    name: path.basename(filePath)
  }));
});

ipcMain.handle('shell:openPath', async (_event, filePath) => {
  return await shell.openPath(filePath);
});

ipcMain.handle('shell:openExternal', async (_event, url) => {
  return await shell.openExternal(url);
});

// Recent projects

ipcMain.handle('projects:getRecent', async () => {
  return loadRecentProjects();
});

ipcMain.handle('projects:addRecent', async (_event, folderPath) => {
  addRecentProject(folderPath);
});

ipcMain.handle('projects:removeRecent', async (_event, folderPath) => {
  let projects = loadRecentProjects();
  projects = projects.filter(p => p.path !== folderPath);
  saveRecentProjects(projects);
});

// System info

ipcMain.handle('system:getInfo', async () => {
  const userInfo = os.userInfo();
  return {
    username: userInfo.username,
    hostname: os.hostname(),
    homeDir: userInfo.homedir
  };
});

ipcMain.handle('fs:ensureDir', async (_event, dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
});

// Search

ipcMain.handle('search:query', async (_event, query, options) => {
  if (!projectService.projectPath) return [];
  return perf.measure('search.query', () => projectService.search(query, options),
    { qLen: typeof query === 'string' ? query.length : 0 });
});

// Convert to HTML

ipcMain.handle('file:convertToHtml', async (_event, filename, name) => {
  if (!projectService.projectPath) return null;
  const raw = fs.readFileSync(path.join(projectService.projectPath, filename), 'utf-8');
  const mdContent = projectService.frontmatter.stripBody(raw);
  const htmlBody = marked(mdContent);
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #1a1a1a; }
    h1, h2, h3, h4 { margin-top: 1.5em; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f0f0f0; padding: 16px; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    img { max-width: 100%; }
    blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 16px; color: #555; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>${name}</h1>
  ${htmlBody}
</body>
</html>`;

  const downloadsDir = path.join(os.homedir(), 'Downloads');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const htmlFilename = slug + '.html';
  const outputPath = path.join(downloadsDir, htmlFilename);
  fs.writeFileSync(outputPath, fullHtml, 'utf-8');
  return { outputPath, downloadsDir };
});

// Convert to Markdown

ipcMain.handle('file:convertToMarkdown', async (_event, filename, name) => {
  if (!projectService.projectPath) return null;
  const mdContent = fs.readFileSync(path.join(projectService.projectPath, filename), 'utf-8');
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const outputPath = path.join(downloadsDir, slug + '.md');
  fs.writeFileSync(outputPath, mdContent, 'utf-8');
  return { outputPath, downloadsDir };
});

// Convert to PDF

ipcMain.handle('file:convertToPdf', async (_event, filename, name) => {
  if (!projectService.projectPath) return null;
  const raw = fs.readFileSync(path.join(projectService.projectPath, filename), 'utf-8');
  const mdContent = projectService.frontmatter.stripBody(raw);
  let htmlBody = marked(mdContent);

  // Resolve ./_attachments/ refs to absolute file:// URLs so images render in the PDF
  const attachmentsDir = path.join(projectService.projectPath, '_attachments');
  htmlBody = htmlBody.replace(
    /(src|href)="\.?\/?_attachments\/([^"]+)"/g,
    (_m, attr, file) => `${attr}="file://${attachmentsDir}/${file}"`
  );

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0 24px; line-height: 1.6; color: #1a1a1a; }
    h1, h2, h3, h4 { margin-top: 1.5em; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f0f0f0; padding: 16px; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    img { max-width: 100%; }
    blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 16px; color: #555; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>${name}</h1>
  ${htmlBody}
</body>
</html>`;

  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  });

  try {
    await pdfWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml));
    const pdfData = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'Letter',
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
    });

    const downloadsDir = path.join(os.homedir(), 'Downloads');
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const outputPath = path.join(downloadsDir, slug + '.pdf');
    fs.writeFileSync(outputPath, pdfData);
    return { outputPath, downloadsDir };
  } finally {
    pdfWindow.destroy();
  }
});

// File history

ipcMain.handle('file:getHistory', async (_event, filename) => {
  if (!projectService.projectPath) return [];
  return await gitService.getFileLog(projectService.projectPath, filename);
});

ipcMain.handle('file:getHistoryContent', async (_event, commit, filename) => {
  if (!projectService.projectPath) return null;
  const raw = await gitService.getFileAtCommit(projectService.projectPath, commit, filename);
  if (raw == null) return null;
  // Strip frontmatter so the history preview renders body markdown only.
  return projectService.frontmatter.stripBody(raw);
});

// Window state

ipcMain.handle('window-state:getLayout', async (_event, folderPath) => {
  return windowStateService.getLayout(folderPath);
});

ipcMain.handle('window-state:saveLayout', async (_event, folderPath, layout) => {
  windowStateService.setLayout(folderPath, layout);
});

ipcMain.handle('window-state:restoreBounds', async (_event, folderPath) => {
  const saved = windowStateService.getBounds(folderPath);
  if (!saved || !saved.bounds) return;

  const bounds = saved.bounds;
  const displays = screen.getAllDisplays();
  const visible = displays.some(d => {
    const db = d.bounds;
    return bounds.x < db.x + db.width && bounds.x + bounds.width > db.x
        && bounds.y < db.y + db.height && bounds.y + bounds.height > db.y;
  });

  if (visible) {
    mainWindow.setBounds(bounds);
  }
  if (saved.isMaximized) {
    mainWindow.maximize();
  }
});


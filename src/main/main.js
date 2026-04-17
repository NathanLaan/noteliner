const { app, BrowserWindow, Menu, ipcMain, dialog, shell, net, protocol, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { GitService } = require('./git-service');
const { ProjectService } = require('./project-service');
const { WindowStateService } = require('./window-state-service');
const { marked } = require('marked');

// Set app name early so Linux WM_CLASS is correct (for dock icon in dev mode)
app.setName('NoteLiner');

// Wayland + Vulkan is an incompatible combination in Chromium — GPU surfaces
// can't survive a screen-lock/unlock cycle, leaving a blank white screen.
// Disabling Vulkan lets Chromium fall back to OpenGL/GLES which handles
// Wayland surface lifecycle correctly.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-vulkan');
}

const RECENT_PROJECTS_FILE = 'recent-projects.json';
const MAX_RECENT = 5;

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
let windowStateService;
let boundsTimer = null;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  Menu.setApplicationMenu(null);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      const levels = ['LOG', 'WARN', 'ERROR'];
      console.log(`[Renderer ${levels[level] || level}] ${message}`);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
  }

  gitService = new GitService((msg) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('git:log', msg);
    }
  });

  projectService = new ProjectService(gitService);
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
    if (projectService.projectPath) {
      windowStateService.setBounds(projectService.projectPath, mainWindow.getNormalBounds(), true);
    }
  });
  mainWindow.on('unmaximize', () => {
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

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('project:open', async (_event, folderPath) => {
  return await projectService.openProject(folderPath);
});

ipcMain.handle('project:init', async (_event, folderPath, remoteUrl) => {
  return await projectService.initProject(folderPath, remoteUrl);
});

ipcMain.handle('project:close', async () => {
  if (!projectService.projectPath) return;
  await gitService.flushPush(projectService.projectPath);
  projectService.projectPath = null;
  projectService.index = null;
});

ipcMain.handle('project:getIndex', async () => {
  return projectService.getIndex();
});

ipcMain.handle('project:saveIndex', async (_event, index) => {
  return await projectService.saveIndex(index);
});

ipcMain.handle('file:read', async (_event, filePath) => {
  return await projectService.readFile(filePath);
});

ipcMain.handle('file:write', async (_event, filePath, content) => {
  try {
    return await projectService.writeFile(filePath, content);
  } catch (err) {
    if (err.code === 'GIT_CONFIG_REQUIRED') return { error: 'git_config_required' };
    throw err;
  }
});

ipcMain.handle('file:create', async (_event, name, tags) => {
  try {
    return await projectService.createFile(name, tags);
  } catch (err) {
    if (err.code === 'GIT_CONFIG_REQUIRED') return { error: 'git_config_required' };
    throw err;
  }
});

ipcMain.handle('file:delete', async (_event, fileId) => {
  try {
    return await projectService.deleteFile(fileId);
  } catch (err) {
    if (err.code === 'GIT_CONFIG_REQUIRED') return { error: 'git_config_required' };
    throw err;
  }
});

ipcMain.handle('file:rename', async (_event, fileId, newName) => {
  try {
    return await projectService.renameFile(fileId, newName);
  } catch (err) {
    if (err.code === 'GIT_CONFIG_REQUIRED') return { error: 'git_config_required' };
    throw err;
  }
});

ipcMain.handle('git:push', async () => {
  if (!projectService.projectPath) return;
  return await gitService.push(projectService.projectPath);
});

ipcMain.handle('git:pull', async () => {
  if (!projectService.projectPath) return;
  return await gitService.pull(projectService.projectPath);
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
  return projectService.search(query, options);
});

// Convert to HTML

ipcMain.handle('file:convertToHtml', async (_event, filename, name) => {
  if (!projectService.projectPath) return null;
  const mdContent = fs.readFileSync(path.join(projectService.projectPath, filename), 'utf-8');
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

// File history

ipcMain.handle('file:getHistory', async (_event, filename) => {
  if (!projectService.projectPath) return [];
  return await gitService.getFileLog(projectService.projectPath, filename);
});

ipcMain.handle('file:getHistoryContent', async (_event, commit, filename) => {
  if (!projectService.projectPath) return null;
  return await gitService.getFileAtCommit(projectService.projectPath, commit, filename);
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


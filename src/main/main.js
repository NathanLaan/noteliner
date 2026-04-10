const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { GitService } = require('./git-service');
const { ProjectService } = require('./project-service');

let mainWindow;
let gitService;
let projectService;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
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
}

app.whenReady().then(() => {
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

ipcMain.handle('file:create', async (_event, name) => {
  try {
    return await projectService.createFile(name);
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


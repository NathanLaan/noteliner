const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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
  return await projectService.writeFile(filePath, content);
});

ipcMain.handle('file:create', async (_event, name) => {
  return await projectService.createFile(name);
});

ipcMain.handle('file:delete', async (_event, fileId) => {
  return await projectService.deleteFile(fileId);
});

ipcMain.handle('file:rename', async (_event, fileId, newName) => {
  return await projectService.renameFile(fileId, newName);
});

ipcMain.handle('git:push', async () => {
  if (!projectService.projectPath) return;
  return await gitService.push(projectService.projectPath);
});

ipcMain.handle('git:pull', async () => {
  if (!projectService.projectPath) return;
  return await gitService.pull(projectService.projectPath);
});


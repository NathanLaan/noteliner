const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Dialog
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),

  // Project
  openProject: (folderPath) => ipcRenderer.invoke('project:open', folderPath),
  initProject: (folderPath, remoteUrl) => ipcRenderer.invoke('project:init', folderPath, remoteUrl),
  getIndex: () => ipcRenderer.invoke('project:getIndex'),
  saveIndex: (index) => ipcRenderer.invoke('project:saveIndex', index),

  // Files
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('file:write', filePath, content),
  createFile: (name) => ipcRenderer.invoke('file:create', name),
  deleteFile: (fileId) => ipcRenderer.invoke('file:delete', fileId),
  renameFile: (fileId, newName) => ipcRenderer.invoke('file:rename', fileId, newName),

  // Git
  gitPush: () => ipcRenderer.invoke('git:push'),
  gitPull: () => ipcRenderer.invoke('git:pull'),

  // Events
  onGitLog: (callback) => {
    const listener = (_event, msg) => callback(msg);
    ipcRenderer.on('git:log', listener);
    return () => ipcRenderer.removeListener('git:log', listener);
  }
});

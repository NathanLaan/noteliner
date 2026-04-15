const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Dialog
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),

  // Project
  openProject: (folderPath) => ipcRenderer.invoke('project:open', folderPath),
  closeProject: () => ipcRenderer.invoke('project:close'),
  initProject: (folderPath, remoteUrl) => ipcRenderer.invoke('project:init', folderPath, remoteUrl),
  getIndex: () => ipcRenderer.invoke('project:getIndex'),
  saveIndex: (index) => ipcRenderer.invoke('project:saveIndex', index),

  // Files
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('file:write', filePath, content),
  createFile: (name, tags) => ipcRenderer.invoke('file:create', name, tags),
  deleteFile: (fileId) => ipcRenderer.invoke('file:delete', fileId),
  renameFile: (fileId, newName) => ipcRenderer.invoke('file:rename', fileId, newName),

  // Git
  gitPush: () => ipcRenderer.invoke('git:push'),
  gitPull: () => ipcRenderer.invoke('git:pull'),
  getGitConfig: () => ipcRenderer.invoke('git:getConfig'),
  setGitConfig: (name, email) => ipcRenderer.invoke('git:setConfig', name, email),
  gitGetRemoteUrl: () => ipcRenderer.invoke('git:getRemoteUrl'),
  gitSetRemoteUrl: (url) => ipcRenderer.invoke('git:setRemoteUrl', url),
  gitRemoveRemote: () => ipcRenderer.invoke('git:removeRemote'),
  gitGetSyncStatus: () => ipcRenderer.invoke('git:getSyncStatus'),
  gitGetBranch: () => ipcRenderer.invoke('git:getBranch'),
  gitPushUpstream: () => ipcRenderer.invoke('git:pushUpstream'),

  // Attachments
  addAttachment: (fileId, buffer, originalName) => ipcRenderer.invoke('file:addAttachment', fileId, buffer, originalName),
  removeAttachment: (fileId, attachmentId) => ipcRenderer.invoke('file:removeAttachment', fileId, attachmentId),
  getAttachmentPath: (filename) => ipcRenderer.invoke('file:getAttachmentPath', filename),
  openFileDialog: () => ipcRenderer.invoke('dialog:openFiles'),
  openPath: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),

  // Recent projects
  getRecentProjects: () => ipcRenderer.invoke('projects:getRecent'),
  addRecentProject: (folderPath) => ipcRenderer.invoke('projects:addRecent', folderPath),
  removeRecentProject: (folderPath) => ipcRenderer.invoke('projects:removeRecent', folderPath),

  // Convert
  convertToHtml: (filename, name) => ipcRenderer.invoke('file:convertToHtml', filename, name),

  // System
  getSystemInfo: () => ipcRenderer.invoke('system:getInfo'),
  ensureDir: (dirPath) => ipcRenderer.invoke('fs:ensureDir', dirPath),

  // Window state
  getWindowState: (folderPath) => ipcRenderer.invoke('window-state:getLayout', folderPath),
  saveWindowState: (folderPath, layout) => ipcRenderer.invoke('window-state:saveLayout', folderPath, layout),
  restoreWindowBounds: (folderPath) => ipcRenderer.invoke('window-state:restoreBounds', folderPath),

  // Events
  onGitLog: (callback) => {
    const listener = (_event, msg) => callback(msg);
    ipcRenderer.on('git:log', listener);
    return () => ipcRenderer.removeListener('git:log', listener);
  }
});

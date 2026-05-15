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
  gitPullRebase: () => ipcRenderer.invoke('git:pullRebase'),
  getGitConfig: () => ipcRenderer.invoke('git:getConfig'),
  setGitConfig: (name, email) => ipcRenderer.invoke('git:setConfig', name, email),
  gitGetRemoteUrl: () => ipcRenderer.invoke('git:getRemoteUrl'),
  gitSetRemoteUrl: (url) => ipcRenderer.invoke('git:setRemoteUrl', url),
  gitRemoveRemote: () => ipcRenderer.invoke('git:removeRemote'),
  gitGetSyncStatus: () => ipcRenderer.invoke('git:getSyncStatus'),
  gitGetBranch: () => ipcRenderer.invoke('git:getBranch'),
  gitPushUpstream: () => ipcRenderer.invoke('git:pushUpstream'),
  gitResetToRemote: () => ipcRenderer.invoke('git:resetToRemote'),

  // Attachments
  addAttachment: (fileId, buffer, originalName) => ipcRenderer.invoke('file:addAttachment', fileId, buffer, originalName),
  removeAttachment: (fileId, attachmentId) => ipcRenderer.invoke('file:removeAttachment', fileId, attachmentId),
  getAttachmentPath: (filename) => ipcRenderer.invoke('file:getAttachmentPath', filename),
  openFileDialog: () => ipcRenderer.invoke('dialog:openFiles'),
  openPath: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Recent projects
  getRecentProjects: () => ipcRenderer.invoke('projects:getRecent'),
  addRecentProject: (folderPath) => ipcRenderer.invoke('projects:addRecent', folderPath),
  removeRecentProject: (folderPath) => ipcRenderer.invoke('projects:removeRecent', folderPath),

  // Search
  searchFiles: (query, options) => ipcRenderer.invoke('search:query', query, options),

  // File history
  getFileHistory: (filename) => ipcRenderer.invoke('file:getHistory', filename),
  getFileHistoryContent: (commit, filename) => ipcRenderer.invoke('file:getHistoryContent', commit, filename),

  // Link graph (wikilinks / backlinks)
  getBacklinks: (fileId) => ipcRenderer.invoke('links:getBacklinks', fileId),
  getAllNoteNames: () => ipcRenderer.invoke('links:getAllNames'),
  rebuildLinkGraph: () => ipcRenderer.invoke('links:rebuild'),

  // Convert
  convertToHtml: (filename, name) => ipcRenderer.invoke('file:convertToHtml', filename, name),
  convertToMarkdown: (filename, name) => ipcRenderer.invoke('file:convertToMarkdown', filename, name),
  convertToPdf: (filename, name) => ipcRenderer.invoke('file:convertToPdf', filename, name),

  // Import
  openImportDialog: () => ipcRenderer.invoke('dialog:openImportFile'),
  importDocument: (sourcePath) => ipcRenderer.invoke('file:import', sourcePath),

  // System
  getSystemInfo: () => ipcRenderer.invoke('system:getInfo'),
  ensureDir: (dirPath) => ipcRenderer.invoke('fs:ensureDir', dirPath),

  // Window state
  getWindowState: (folderPath) => ipcRenderer.invoke('window-state:getLayout', folderPath),
  saveWindowState: (folderPath, layout) => ipcRenderer.invoke('window-state:saveLayout', folderPath, layout),
  restoreWindowBounds: (folderPath) => ipcRenderer.invoke('window-state:restoreBounds', folderPath),

  // UI preferences (global, persisted to ui-preferences.json)
  getUIPrefs: () => ipcRenderer.invoke('ui:getPrefs'),
  setUIPrefs: (prefs) => ipcRenderer.invoke('ui:setPrefs', prefs),

  // App lifecycle
  relaunchApp: () => ipcRenderer.invoke('app:relaunch'),

  // Help window (separate non-modal BrowserWindow)
  openHelpWindow: () => ipcRenderer.invoke('help:open'),

  // Custom window controls
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onWindowMaximizedChange: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('window:maximized', listener);
    return () => ipcRenderer.removeListener('window:maximized', listener);
  },

  // Events
  onGitLog: (callback) => {
    const listener = (_event, msg) => callback(msg);
    ipcRenderer.on('git:log', listener);
    return () => ipcRenderer.removeListener('git:log', listener);
  }
});

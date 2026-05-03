// Test helpers exposed on window.__nlTest when the renderer is loaded with ?test=1.
// Driven by Playwright tests; a no-op in normal builds (the query param is only set
// by main.js when NODE_ENV=test).
//
// The helpers compose the same calls the UI makes (IPC + project store update),
// so tests exercise the real persistence and reactive paths without driving every
// modal click.

export function installTestHelpers(projectState) {
  const params = new URLSearchParams(window.location.search);
  if (params.get('test') !== '1') return;

  window.__nlTest = {
    async initProject(folderPath, remoteUrl = null) {
      const result = await window.api.initProject(folderPath, remoteUrl);
      if (result?.status === 'loaded') {
        projectState.load(folderPath, result.index);
      }
      return result;
    },

    async openProject(folderPath) {
      const result = await window.api.openProject(folderPath);
      if (result?.status === 'loaded') {
        projectState.load(folderPath, result.index);
      }
      return result;
    },

    async createFile(name, tags = []) {
      const entry = await window.api.createFile(name, tags);
      if (entry && !entry.error) {
        projectState.addFile(entry);
        await projectState.selectFile(entry.id);
      }
      return entry;
    },

    async selectFile(fileId) {
      await projectState.selectFile(fileId);
    },

    async writeBody(content) {
      const file = projectState.selectedFile;
      if (!file) throw new Error('No file selected');
      projectState.editorContent = content;
      await window.api.writeFile(file.filename, content);
    },

    async renameFile(fileId, newName) {
      const updated = await window.api.renameFile(fileId, newName);
      if (updated && !updated.error) {
        projectState.updateFile(fileId, {
          name: updated.name,
          filename: updated.filename,
        });
      }
      return updated;
    },

    async deleteFile(fileId) {
      const result = await window.api.deleteFile(fileId);
      if (!result || !result.error) {
        projectState.removeFile(fileId);
      }
      return result;
    },

    async addAttachment(buffer, originalName) {
      const file = projectState.selectedFile;
      if (!file) throw new Error('No file selected');
      const att = await window.api.addAttachment(file.id, buffer, originalName);
      if (att && !att.error) {
        projectState.addAttachment(file.id, att);
      }
      return att;
    },

    snapshot() {
      return {
        isOpen: projectState.isOpen,
        folderPath: projectState.folderPath,
        selectedFileId: projectState.selectedFileId,
        editorContent: projectState.editorContent,
        files: projectState.index.files.map(f => ({
          id: f.id,
          name: f.name,
          filename: f.filename,
          parentId: f.parentId,
          tags: [...(f.tags || [])],
          attachments: (f.attachments || []).map(a => ({ ...a })),
        })),
      };
    },
  };
}

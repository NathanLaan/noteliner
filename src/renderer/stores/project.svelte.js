// Reactive project state using Svelte 5 runes via a class with $state fields.
// Exported as a singleton module-level instance.

class ProjectState {
  isOpen = $state(false);
  folderPath = $state('');
  index = $state({ version: 1, files: [] });
  selectedFileId = $state(null);
  editorContent = $state('');

  load(folderPath, index) {
    this.folderPath = folderPath;
    this.index = index;
    this.isOpen = true;
    this.selectedFileId = null;
    this.editorContent = '';
  }

  close() {
    this.isOpen = false;
    this.folderPath = '';
    this.index = { version: 1, files: [] };
    this.selectedFileId = null;
    this.editorContent = '';
  }

  addFile(entry) {
    this.index.files.push(entry);
  }

  removeFile(fileId) {
    this.index.files = this.index.files.filter(f => f.id !== fileId);
    if (this.selectedFileId === fileId) {
      this.selectedFileId = null;
      this.editorContent = '';
    }
  }

  updateFile(fileId, updates) {
    const file = this.index.files.find(f => f.id === fileId);
    if (file) {
      Object.assign(file, updates);
    }
  }

  async selectFile(fileId) {
    this.selectedFileId = fileId;
    const file = this.index.files.find(f => f.id === fileId);
    if (file) {
      const content = await window.api.readFile(file.filename);
      this.editorContent = content;
    }
  }

  get selectedFile() {
    if (!this.selectedFileId) return null;
    return this.index.files.find(f => f.id === this.selectedFileId) || null;
  }

  getChildren(parentId) {
    return this.index.files
      .filter(f => f.parentId === parentId)
      .sort((a, b) => a.order - b.order);
  }
}

export const projectState = new ProjectState();

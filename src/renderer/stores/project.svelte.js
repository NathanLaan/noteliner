// Reactive project state using Svelte 5 runes via a class with $state fields.
// Exported as a singleton module-level instance.

class ProjectState {
  isOpen = $state(false);
  folderPath = $state('');
  index = $state({ version: 2, files: [] });
  selectedFileId = $state(null);
  editorContent = $state('');
  scrollToLine = $state(null);
  cursorLine = $state(1);

  load(folderPath, index) {
    this.folderPath = folderPath;
    this.index = index;
    this.isOpen = true;
    this.selectedFileId = null;
    this.editorContent = '';
    this.scrollToLine = null;
  }

  close() {
    this.isOpen = false;
    this.folderPath = '';
    this.index = { version: 2, files: [] };
    this.selectedFileId = null;
    this.editorContent = '';
    this.scrollToLine = null;
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

  get selectedFileAttachments() {
    const file = this.selectedFile;
    if (!file) return [];
    return file.attachments || [];
  }

  addAttachment(fileId, attachment) {
    const file = this.index.files.find(f => f.id === fileId);
    if (file) {
      if (!file.attachments) file.attachments = [];
      file.attachments.push(attachment);
    }
  }

  removeAttachment(fileId, attachmentId) {
    const file = this.index.files.find(f => f.id === fileId);
    if (file && file.attachments) {
      file.attachments = file.attachments.filter(a => a.id !== attachmentId);
    }
  }

  getChildren(parentId) {
    return this.index.files
      .filter(f => f.parentId === parentId)
      .sort((a, b) => a.order - b.order);
  }

  // Returns files flattened into display order (depth-first, following the tree)
  getFlatFileList() {
    const result = [];
    const walk = (parentId) => {
      for (const file of this.getChildren(parentId)) {
        result.push(file);
        walk(file.id);
      }
    };
    walk(null);
    return result;
  }

  selectPrevFile() {
    const list = this.getFlatFileList();
    if (list.length === 0) return;
    if (!this.selectedFileId) {
      this.selectFile(list[0].id);
      return;
    }
    const idx = list.findIndex(f => f.id === this.selectedFileId);
    if (idx > 0) this.selectFile(list[idx - 1].id);
  }

  selectNextFile() {
    const list = this.getFlatFileList();
    if (list.length === 0) return;
    if (!this.selectedFileId) {
      this.selectFile(list[0].id);
      return;
    }
    const idx = list.findIndex(f => f.id === this.selectedFileId);
    if (idx >= 0 && idx < list.length - 1) this.selectFile(list[idx + 1].id);
  }

  get allTags() {
    const tagSet = new Set();
    for (const file of this.index.files) {
      if (file.tags) {
        for (const tag of file.tags) tagSet.add(tag);
      }
    }
    return [...tagSet].sort();
  }

  get selectedFileTags() {
    const file = this.selectedFile;
    if (!file) return [];
    return file.tags || [];
  }

  addTag(fileId, tag) {
    const file = this.index.files.find(f => f.id === fileId);
    if (!file) return;
    if (!file.tags) file.tags = [];
    const normalized = tag.trim();
    if (normalized && !file.tags.includes(normalized)) {
      file.tags = [...file.tags, normalized];
    }
  }

  removeTag(fileId, tag) {
    const file = this.index.files.find(f => f.id === fileId);
    if (!file || !file.tags) return;
    file.tags = file.tags.filter(t => t !== tag);
  }

  getFilesWithTag(tag) {
    return this.index.files
      .filter(f => f.tags && f.tags.includes(tag))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

export const projectState = new ProjectState();

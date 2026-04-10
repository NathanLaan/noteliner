const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const INDEX_FILE = 'noteliner.json';

class ProjectService {
  constructor(gitService) {
    this.gitService = gitService;
    this.projectPath = null;
    this.index = null;
  }

  indexPath() {
    return path.join(this.projectPath, INDEX_FILE);
  }

  async openProject(folderPath) {
    this.projectPath = folderPath;

    const isGit = await this.gitService.isGitRepo(folderPath);
    const hasIndex = fs.existsSync(path.join(folderPath, INDEX_FILE));

    if (isGit && hasIndex) {
      // Existing project — load it
      await this.gitService.pull(folderPath);
      this.index = JSON.parse(fs.readFileSync(this.indexPath(), 'utf-8'));
      return { status: 'loaded', index: this.index };
    }

    if (isGit && !hasIndex) {
      // Git repo but no index — create index
      this.index = { version: 1, files: [] };
      fs.writeFileSync(this.indexPath(), JSON.stringify(this.index, null, 2));
      await this.gitService.commit(folderPath, 'Initialize noteliner.json');
      return { status: 'loaded', index: this.index };
    }

    // Not a git repo — needs setup
    return { status: 'needs_setup' };
  }

  async initProject(folderPath, remoteUrl) {
    this.projectPath = folderPath;

    if (remoteUrl) {
      // Clone from remote
      await this.gitService.clone(remoteUrl, folderPath);
      const hasIndex = fs.existsSync(this.indexPath());
      if (hasIndex) {
        this.index = JSON.parse(fs.readFileSync(this.indexPath(), 'utf-8'));
      } else {
        this.index = { version: 1, files: [] };
        fs.writeFileSync(this.indexPath(), JSON.stringify(this.index, null, 2));
        await this.gitService.commit(folderPath, 'Initialize noteliner.json');
        await this.gitService.push(folderPath);
      }
    } else {
      // Create new local repo
      await this.gitService.init(folderPath);
      this.index = { version: 1, files: [] };
      fs.writeFileSync(this.indexPath(), JSON.stringify(this.index, null, 2));
      await this.gitService.commit(folderPath, 'Initialize noteliner.json');
    }

    return { status: 'loaded', index: this.index };
  }

  getIndex() {
    return this.index;
  }

  async saveIndex(index) {
    this.index = index;
    fs.writeFileSync(this.indexPath(), JSON.stringify(this.index, null, 2));
    await this.gitService.commit(this.projectPath, 'Update index');
    this.gitService.schedulePush(this.projectPath);
  }

  async readFile(filename) {
    const filePath = path.join(this.projectPath, filename);
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf-8');
  }

  async writeFile(filename, content) {
    const filePath = path.join(this.projectPath, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    await this.gitService.commit(this.projectPath, `Update ${filename}`);
    this.gitService.schedulePush(this.projectPath);
  }

  async createFile(name) {
    const id = uuidv4();
    const filename = this.slugify(name) + '.md';

    const entry = {
      id,
      name,
      filename,
      parentId: null,
      order: this.index.files.length,
      tags: []
    };

    // Create the file on disk
    const filePath = path.join(this.projectPath, filename);
    fs.writeFileSync(filePath, '', 'utf-8');

    // Update index
    this.index.files.push(entry);
    fs.writeFileSync(this.indexPath(), JSON.stringify(this.index, null, 2));

    await this.gitService.commit(this.projectPath, `Add ${name}`);
    this.gitService.schedulePush(this.projectPath);

    return entry;
  }

  async deleteFile(fileId) {
    const entry = this.index.files.find(f => f.id === fileId);
    if (!entry) return;

    // Remove file from disk
    const filePath = path.join(this.projectPath, entry.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Re-parent children to deleted file's parent
    this.index.files.forEach(f => {
      if (f.parentId === fileId) {
        f.parentId = entry.parentId;
      }
    });

    // Remove from index
    this.index.files = this.index.files.filter(f => f.id !== fileId);
    fs.writeFileSync(this.indexPath(), JSON.stringify(this.index, null, 2));

    await this.gitService.commit(this.projectPath, `Delete ${entry.name}`);
    this.gitService.schedulePush(this.projectPath);
  }

  async renameFile(fileId, newName) {
    const entry = this.index.files.find(f => f.id === fileId);
    if (!entry) return;

    const oldFilename = entry.filename;
    const newFilename = this.slugify(newName) + '.md';

    // Rename on disk
    const oldPath = path.join(this.projectPath, oldFilename);
    const newPath = path.join(this.projectPath, newFilename);
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
    }

    entry.name = newName;
    entry.filename = newFilename;
    fs.writeFileSync(this.indexPath(), JSON.stringify(this.index, null, 2));

    await this.gitService.commit(this.projectPath, `Rename ${oldFilename} to ${newFilename}`);
    this.gitService.schedulePush(this.projectPath);

    return entry;
  }

  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}

module.exports = { ProjectService };

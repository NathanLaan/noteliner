const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const INDEX_FILE = 'noteliner.json';
const ATTACHMENTS_DIR = '_attachments';
const MAX_ATTACHMENT_SIZE = 30 * 1024 * 1024; // 30MB

const MIME_TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv', '.txt': 'text/plain', '.zip': 'application/zip',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.json': 'application/json',
};

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
      this.migrateIndex();
      const needsGitConfig = await this.checkGitConfig();
      return { status: 'loaded', index: this.index, needsGitConfig };
    }

    if (isGit && !hasIndex) {
      // Git repo but no index — create index
      this.index = { version: 2, files: [] };
      fs.writeFileSync(this.indexPath(), JSON.stringify(this.index, null, 2));
      const needsGitConfig = await this.checkGitConfig();
      if (!needsGitConfig) {
        await this.gitService.commit(folderPath, 'Initialize noteliner.json');
      }
      return { status: 'loaded', index: this.index, needsGitConfig };
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
        this.migrateIndex();
      } else {
        this.index = { version: 2, files: [] };
        fs.writeFileSync(this.indexPath(), JSON.stringify(this.index, null, 2));
        await this.gitService.commit(folderPath, 'Initialize noteliner.json');
        await this.gitService.push(folderPath);
      }
    } else {
      // Create new local repo
      await this.gitService.init(folderPath);
      this.index = { version: 2, files: [] };
      fs.writeFileSync(this.indexPath(), JSON.stringify(this.index, null, 2));
      await this.gitService.commit(folderPath, 'Initialize noteliner.json');
    }

    const needsGitConfig = await this.checkGitConfig();
    return { status: 'loaded', index: this.index, needsGitConfig };
  }

  async checkGitConfig() {
    const config = await this.gitService.checkConfig(this.projectPath);
    return !config.name || !config.email;
  }

  async getGitConfig() {
    return await this.gitService.checkConfig(this.projectPath);
  }

  async setGitConfig(name, email) {
    await this.gitService.setConfig(this.projectPath, 'user.name', name);
    await this.gitService.setConfig(this.projectPath, 'user.email', email);
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

  async createFile(name, tags) {
    const id = uuidv4();
    const filename = this.slugify(name) + '.md';

    const entry = {
      id,
      name,
      filename,
      parentId: null,
      order: this.index.files.length,
      tags: Array.isArray(tags) ? tags : [],
      attachments: []
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

  migrateIndex() {
    if (!this.index.version || this.index.version < 2) {
      for (const file of this.index.files) {
        if (!file.attachments) file.attachments = [];
      }
      this.index.version = 2;
      fs.writeFileSync(this.indexPath(), JSON.stringify(this.index, null, 2));
    }
  }

  attachmentsDir() {
    return path.join(this.projectPath, ATTACHMENTS_DIR);
  }

  async addAttachment(fileId, buffer, originalName) {
    if (buffer.byteLength > MAX_ATTACHMENT_SIZE) {
      throw new Error(`File exceeds 30MB limit (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB)`);
    }

    const entry = this.index.files.find(f => f.id === fileId);
    if (!entry) throw new Error('File not found');

    const ext = path.extname(originalName).toLowerCase();
    const id = uuidv4().split('-')[0];
    const storedFilename = `att-${id}${ext}`;
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    // Ensure _attachments directory exists
    const dir = this.attachmentsDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Write file to disk
    fs.writeFileSync(path.join(dir, storedFilename), Buffer.from(buffer));

    const attachment = {
      id,
      originalName,
      filename: storedFilename,
      mimeType,
      size: buffer.byteLength,
      addedAt: new Date().toISOString()
    };

    entry.attachments.push(attachment);
    fs.writeFileSync(this.indexPath(), JSON.stringify(this.index, null, 2));

    await this.gitService.commit(this.projectPath, `Attach ${originalName}`);
    this.gitService.schedulePush(this.projectPath);

    return attachment;
  }

  async removeAttachment(fileId, attachmentId) {
    const entry = this.index.files.find(f => f.id === fileId);
    if (!entry) return;

    const idx = entry.attachments.findIndex(a => a.id === attachmentId);
    if (idx === -1) return;

    const attachment = entry.attachments[idx];

    // Remove file from disk
    const filePath = path.join(this.attachmentsDir(), attachment.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    entry.attachments.splice(idx, 1);
    fs.writeFileSync(this.indexPath(), JSON.stringify(this.index, null, 2));

    await this.gitService.commit(this.projectPath, `Remove attachment ${attachment.originalName}`);
    this.gitService.schedulePush(this.projectPath);
  }

  getAttachmentPath(filename) {
    return path.join(this.attachmentsDir(), filename);
  }

  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}

module.exports = { ProjectService };

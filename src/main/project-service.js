const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { FrontmatterService } = require('./frontmatter-service');

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
    this.frontmatter = new FrontmatterService();
    // Toggle for whether NoteLiner emits frontmatter on writes. Read remains
    // strip-aware regardless. Set externally by main from ui-preferences.
    this.writeFrontmatter = true;
  }

  setWriteFrontmatter(on) {
    this.writeFrontmatter = !!on;
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
      // Sync on-disk frontmatter to the loaded index. Skipped when git config
      // is missing — a commit would fail; the next open after config is set
      // will catch up.
      if (!needsGitConfig) {
        const rewritten = this.reconcileFrontmatter();
        if (rewritten > 0) {
          await this.gitService.commit(this.projectPath, `Sync frontmatter on ${rewritten} note${rewritten === 1 ? '' : 's'}`);
          this.gitService.schedulePush(this.projectPath);
        }
      }
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
    // Diff old vs new for files whose mirrored frontmatter fields changed
    // (name or tags). These need their on-disk frontmatter refreshed so the
    // mirror tracks the index. parentId / order changes are not mirrored.
    const oldByFilename = new Map();
    if (this.index?.files) {
      for (const f of this.index.files) oldByFilename.set(f.filename, f);
    }

    this.index = index;
    fs.writeFileSync(this.indexPath(), JSON.stringify(this.index, null, 2));

    if (this.writeFrontmatter) {
      for (const entry of this.index.files) {
        const old = oldByFilename.get(entry.filename);
        if (!old || this.entryMirrorDiffers(old, entry)) {
          this.rewriteFrontmatter(entry);
        }
      }
    }

    await this.gitService.commit(this.projectPath, 'Update index');
    this.gitService.schedulePush(this.projectPath);
  }

  entryMirrorDiffers(a, b) {
    if (a.name !== b.name) return true;
    const at = Array.isArray(a.tags) ? a.tags : [];
    const bt = Array.isArray(b.tags) ? b.tags : [];
    if (at.length !== bt.length) return true;
    for (let i = 0; i < at.length; i++) if (at[i] !== bt[i]) return true;
    return false;
  }

  async readFile(filename) {
    const filePath = path.join(this.projectPath, filename);
    if (!fs.existsSync(filePath)) return '';
    const raw = fs.readFileSync(filePath, 'utf-8');
    return this.frontmatter.stripBody(raw);
  }

  // Writes the body, reattaching mirrored frontmatter from the index entry.
  // When the writeFrontmatter toggle is off, the body is written raw — any
  // existing frontmatter on disk is dropped on the next save.
  async writeFile(filename, body) {
    const filePath = path.join(this.projectPath, filename);
    let outContent = body;
    if (this.writeFrontmatter) {
      const entry = this.index?.files.find(f => f.filename === filename);
      const existingData = fs.existsSync(filePath)
        ? this.frontmatter.parse(fs.readFileSync(filePath, 'utf-8')).data
        : {};
      const data = entry
        ? this.frontmatter.mirrorFromIndexEntry(entry, existingData)
        : existingData;
      outContent = this.frontmatter.serialize(body, data);
    }
    fs.writeFileSync(filePath, outContent, 'utf-8');
    await this.gitService.commit(this.projectPath, `Update ${filename}`);
    this.gitService.schedulePush(this.projectPath);
  }

  // Refreshes only the frontmatter on disk for `entry`, preserving the
  // existing body. Used after non-body operations (rename, tag change) so
  // the on-disk mirror matches the index without forcing a body write.
  rewriteFrontmatter(entry) {
    if (!this.writeFrontmatter) return false;
    const filePath = path.join(this.projectPath, entry.filename);
    if (!fs.existsSync(filePath)) return false;
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data: existingData, body } = this.frontmatter.parse(raw);
    const data = this.frontmatter.mirrorFromIndexEntry(entry, existingData);
    const next = this.frontmatter.serialize(body, data);
    if (next !== raw) {
      fs.writeFileSync(filePath, next, 'utf-8');
      return true;
    }
    return false;
  }

  async createFile(name, tags, options = {}) {
    if (!name || !name.trim()) throw new Error('File name cannot be empty');
    const id = uuidv4();
    const filename = this.uniqueFilename(this.slugify(name) + '.md');

    const entry = {
      id,
      name,
      filename,
      parentId: null,
      order: this.index.files.length,
      tags: Array.isArray(tags) ? tags : [],
      attachments: []
    };

    const filePath = path.join(this.projectPath, filename);
    let initialBody;
    if (options.body != null) {
      initialBody = options.body;
    } else {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      initialBody = `# ${name} ${yyyy}-${mm}-${dd}\n`;
    }
    if (this.writeFrontmatter) {
      const data = this.frontmatter.mirrorFromIndexEntry(entry);
      fs.writeFileSync(filePath, this.frontmatter.serialize(initialBody, data), 'utf-8');
    } else {
      fs.writeFileSync(filePath, initialBody, 'utf-8');
    }

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
    if (!newName || !newName.trim()) return;
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

    // Refresh the file's mirrored frontmatter (name changed) before committing
    // so rename + frontmatter update land in a single commit.
    this.rewriteFrontmatter(entry);

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

  // Walks every entry, refreshes frontmatter for files whose on-disk mirror
  // is missing or diverges from the index. Returns the count of files
  // rewritten so the caller can decide whether to make a single commit.
  // No-op when writeFrontmatter is disabled.
  reconcileFrontmatter() {
    if (!this.writeFrontmatter) return 0;
    if (!this.index?.files) return 0;
    let rewritten = 0;
    for (const entry of this.index.files) {
      const filePath = path.join(this.projectPath, entry.filename);
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = this.frontmatter.parse(raw);
      const wanted = this.frontmatter.mirrorFromIndexEntry(entry, parsed.data);
      if (this.frontmatter.mirrorDiverges(parsed.data, wanted)) {
        const next = this.frontmatter.serialize(parsed.body, wanted);
        if (next !== raw) {
          fs.writeFileSync(filePath, next, 'utf-8');
          rewritten++;
        }
      }
    }
    return rewritten;
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

  search(query, options = {}) {
    if (!this.projectPath || !query) return [];
    const caseSensitive = options.caseSensitive || false;
    const searchStr = caseSensitive ? query : query.toLowerCase();
    const results = [];

    for (const file of this.index.files) {
      const filePath = path.join(this.projectPath, file.filename);
      if (!fs.existsSync(filePath)) continue;
      // Search the body only — matches against frontmatter (id, name, tags)
      // would surprise users who don't see frontmatter in the editor.
      const raw = fs.readFileSync(filePath, 'utf-8');
      const content = this.frontmatter.stripBody(raw);
      const lines = content.split('\n');
      const matches = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const compareLine = caseSensitive ? line : line.toLowerCase();
        if (compareLine.includes(searchStr)) {
          matches.push({ line: i + 1, text: line.trimEnd() });
        }
      }

      if (matches.length > 0) {
        results.push({
          fileId: file.id,
          fileName: file.name,
          filename: file.filename,
          matches,
        });
      }
    }
    return results;
  }

  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  uniqueFilename(filename) {
    const existing = new Set(this.index.files.map(f => f.filename));
    if (!existing.has(filename) && !fs.existsSync(path.join(this.projectPath, filename))) {
      return filename;
    }
    const ext = path.extname(filename);
    const stem = filename.slice(0, -ext.length);
    for (let i = 2; i < 10000; i++) {
      const candidate = `${stem}-${i}${ext}`;
      if (!existing.has(candidate) && !fs.existsSync(path.join(this.projectPath, candidate))) {
        return candidate;
      }
    }
    throw new Error('Could not find a unique filename');
  }
}

module.exports = { ProjectService };

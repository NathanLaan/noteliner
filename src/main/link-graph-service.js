const fs = require('fs');
const path = require('path');

const WIKILINK_RE = /\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/g;

class LinkGraphService {
  constructor(projectService) {
    this.projectService = projectService;
    this.outgoing = new Map();
    this.incoming = new Map();
    this.dangling = new Map();
  }

  reset() {
    this.outgoing.clear();
    this.incoming.clear();
    this.dangling.clear();
  }

  buildNameIndex() {
    const map = new Map();
    if (!this.projectService.index) return map;
    for (const file of this.projectService.index.files) {
      map.set(file.name.toLowerCase(), file.id);
    }
    return map;
  }

  parseLinks(content) {
    const names = [];
    for (const match of content.matchAll(WIKILINK_RE)) {
      names.push(match[1].trim());
    }
    return names;
  }

  async rebuild() {
    this.reset();
    if (!this.projectService.projectPath || !this.projectService.index) return;
    const nameToId = this.buildNameIndex();
    for (const file of this.projectService.index.files) {
      const filePath = path.join(this.projectService.projectPath, file.filename);
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf-8');
      this.applyFileLinks(file.id, content, nameToId);
    }
  }

  applyFileLinks(fileId, content, nameToId) {
    const prevOutgoing = this.outgoing.get(fileId) || new Set();
    for (const targetId of prevOutgoing) {
      this.incoming.get(targetId)?.delete(fileId);
    }

    const newOutgoing = new Set();
    const newDangling = new Set();
    for (const rawName of this.parseLinks(content)) {
      const targetId = nameToId.get(rawName.toLowerCase());
      if (!targetId) {
        newDangling.add(rawName);
      } else if (targetId !== fileId) {
        newOutgoing.add(targetId);
      }
    }

    this.outgoing.set(fileId, newOutgoing);
    this.dangling.set(fileId, newDangling);
    for (const targetId of newOutgoing) {
      if (!this.incoming.has(targetId)) this.incoming.set(targetId, new Set());
      this.incoming.get(targetId).add(fileId);
    }
  }

  async scanFile(fileId) {
    if (!this.projectService.projectPath || !this.projectService.index) return;
    const file = this.projectService.index.files.find(f => f.id === fileId);
    if (!file) return;
    const filePath = path.join(this.projectService.projectPath, file.filename);
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');
    const nameToId = this.buildNameIndex();
    this.applyFileLinks(fileId, content, nameToId);
  }

  removeFile(fileId) {
    const outgoing = this.outgoing.get(fileId) || new Set();
    for (const targetId of outgoing) {
      this.incoming.get(targetId)?.delete(fileId);
    }
    this.outgoing.delete(fileId);
    this.dangling.delete(fileId);

    const incoming = this.incoming.get(fileId) || new Set();
    for (const sourceId of incoming) {
      const src = this.outgoing.get(sourceId);
      if (src) src.delete(fileId);
    }
    this.incoming.delete(fileId);
  }

  getBacklinkIds(fileId) {
    return [...(this.incoming.get(fileId) || new Set())];
  }

  getBacklinkSnippets(fileId) {
    if (!this.projectService.projectPath || !this.projectService.index) return [];
    const target = this.projectService.index.files.find(f => f.id === fileId);
    if (!target) return [];
    const targetNameLower = target.name.toLowerCase();
    const sourceIds = this.getBacklinkIds(fileId);
    const results = [];

    for (const sourceId of sourceIds) {
      const source = this.projectService.index.files.find(f => f.id === sourceId);
      if (!source) continue;
      const filePath = path.join(this.projectService.projectPath, source.filename);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const matches = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const m of line.matchAll(WIKILINK_RE)) {
          if (m[1].trim().toLowerCase() === targetNameLower) {
            matches.push({ line: i + 1, text: line.trim() });
            break;
          }
        }
      }

      if (matches.length > 0) {
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          matches,
        });
      }
    }

    results.sort((a, b) => a.sourceName.localeCompare(b.sourceName));
    return results;
  }

  getAllNoteNames() {
    if (!this.projectService.index) return [];
    return this.projectService.index.files.map(f => f.name);
  }
}

module.exports = { LinkGraphService, WIKILINK_RE };

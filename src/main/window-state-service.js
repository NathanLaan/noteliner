const fs = require('fs');
const path = require('path');

class WindowStateService {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {};
    this.saveTimer = null;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      }
    } catch {
      this.data = {};
    }
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch { /* ignore write errors */ }
  }

  scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, 1000);
  }

  saveNow() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.save();
  }

  getEntry(folderPath) {
    return this.data[folderPath] || null;
  }

  getLayout(folderPath) {
    const entry = this.getEntry(folderPath);
    return entry ? entry.layout || null : null;
  }

  setLayout(folderPath, layout) {
    if (!this.data[folderPath]) this.data[folderPath] = {};
    this.data[folderPath].layout = layout;
    this.scheduleSave();
  }

  getBounds(folderPath) {
    const entry = this.getEntry(folderPath);
    if (!entry) return null;
    return { bounds: entry.bounds || null, isMaximized: entry.isMaximized || false };
  }

  setBounds(folderPath, bounds, isMaximized) {
    if (!this.data[folderPath]) this.data[folderPath] = {};
    this.data[folderPath].bounds = bounds;
    this.data[folderPath].isMaximized = isMaximized;
    this.scheduleSave();
  }

  setBoundsSync(folderPath, bounds, isMaximized) {
    if (!this.data[folderPath]) this.data[folderPath] = {};
    this.data[folderPath].bounds = bounds;
    this.data[folderPath].isMaximized = isMaximized;
    this.saveNow();
  }
}

module.exports = { WindowStateService };

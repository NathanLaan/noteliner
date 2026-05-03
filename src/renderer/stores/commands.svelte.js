// Central command registry. Every user-invokable action — toolbar button,
// keyboard shortcut, palette entry — flows through here. Each command is
// the SoT for its own shortcut display, applicability, and behavior.
//
// Shape:
//   {
//     id:       string  - dotted, stable, e.g. 'file.new'
//     label:    string  - palette + shortcuts list display
//     section:  string  - palette grouping; 'File' | 'View' | 'Tags' | ...
//     shortcut: string? - display label like 'Ctrl+Shift+,'; absent for actions without one
//     matches:  (KeyboardEvent) => bool? - predicate for keyboard dispatch
//     when:     () => bool?            - if false, hidden in palette + shortcut ignored
//     run:      () => any              - invoked on dispatch
//   }

const RECENT_CAP = 8;

class CommandRegistry {
  commands = $state([]);
  recentIds = $state([]);

  register(cmd) {
    if (!cmd?.id) throw new Error('Command requires id');
    const idx = this.commands.findIndex(c => c.id === cmd.id);
    if (idx >= 0) this.commands[idx] = cmd;
    else this.commands.push(cmd);
  }

  unregister(id) {
    this.commands = this.commands.filter(c => c.id !== id);
  }

  get(id) {
    return this.commands.find(c => c.id === id) || null;
  }

  isApplicable(cmd) {
    if (!cmd?.when) return true;
    try { return !!cmd.when(); } catch { return false; }
  }

  run(id) {
    const cmd = this.get(id);
    if (!cmd) return false;
    if (!this.isApplicable(cmd)) return false;
    this.recordUse(id);
    try { cmd.run(); } catch (e) { console.error('command failed:', id, e); }
    return true;
  }

  // Iterate in registration order; first applicable command whose `matches`
  // accepts the event wins.
  dispatchKeyEvent(e) {
    for (const cmd of this.commands) {
      if (!cmd.matches) continue;
      let hit = false;
      try { hit = !!cmd.matches(e); } catch { hit = false; }
      if (!hit) continue;
      if (!this.isApplicable(cmd)) continue;
      e.preventDefault();
      this.recordUse(cmd.id);
      try { cmd.run(); } catch (err) { console.error('command failed:', cmd.id, err); }
      return cmd.id;
    }
    return null;
  }

  recordUse(id) {
    this.recentIds = [id, ...this.recentIds.filter(x => x !== id)].slice(0, RECENT_CAP);
  }

  loadRecents(ids) {
    if (Array.isArray(ids)) {
      this.recentIds = ids.filter(x => typeof x === 'string').slice(0, RECENT_CAP);
    }
  }

  // For the palette: applicable commands sorted by recency-then-alpha.
  applicableCommands() {
    const apps = this.commands.filter(c => this.isApplicable(c));
    const recIdx = new Map(this.recentIds.map((id, i) => [id, i]));
    return [...apps].sort((a, b) => {
      const ra = recIdx.has(a.id) ? recIdx.get(a.id) : Infinity;
      const rb = recIdx.has(b.id) ? recIdx.get(b.id) : Infinity;
      if (ra !== rb) return ra - rb;
      return a.label.localeCompare(b.label);
    });
  }

  // For SettingsModal — every command with a shortcut, alpha by section/label.
  shortcutList() {
    return this.commands
      .filter(c => c.shortcut)
      .map(c => ({ keys: c.shortcut, action: c.label, section: c.section || '' }))
      .sort((a, b) => {
        if (a.section !== b.section) return a.section.localeCompare(b.section);
        return a.action.localeCompare(b.action);
      });
  }
}

export const commandRegistry = new CommandRegistry();

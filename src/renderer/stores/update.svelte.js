// Update state machine driven by main-process electron-updater events.
//
// States:
//   idle         — no check has been performed yet
//   checking     — checkForUpdates() in flight
//   available    — a newer release was found; awaiting downloadUpdate()
//   downloading  — bytes are moving; `percent` is populated
//   downloaded   — install pending; quitAndInstall() will restart the app
//   unavailable  — running the latest version (or updates disabled in dev)
//   error        — last operation failed; `error` is populated

class UpdateState {
  state = $state('idle');
  version = $state(null);
  percent = $state(0);
  notes = $state(null);
  error = $state(null);
  reason = $state(null);

  apply(payload) {
    if (!payload || typeof payload !== 'object') return;
    this.state = payload.state ?? 'idle';
    // Only overwrite fields the new payload actually carries — letting them
    // linger means the "downloaded" UI can still show the version that came
    // in on the prior "available" event.
    if ('version' in payload) this.version = payload.version ?? null;
    if ('percent' in payload) this.percent = payload.percent ?? 0;
    if ('notes'   in payload) this.notes   = payload.notes   ?? null;
    if ('error'   in payload) this.error   = payload.error   ?? null;
    if ('reason'  in payload) this.reason  = payload.reason  ?? null;
  }

  async check() {
    await window.api?.checkForUpdates();
  }

  async download() {
    await window.api?.downloadUpdate();
  }

  async install() {
    await window.api?.installUpdate();
  }
}

export const updateState = new UpdateState();

// Subscribe to main-process state pushes and seed initial state. Both calls
// guard on window.api so the module is safe to import outside Electron (e.g.
// Vite SSR pass).
if (typeof window !== 'undefined' && window.api) {
  window.api.onUpdateState((payload) => updateState.apply(payload));
  window.api.getUpdateState().then((payload) => updateState.apply(payload));
}

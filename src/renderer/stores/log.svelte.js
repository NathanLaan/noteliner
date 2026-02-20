class LogState {
  entries = $state([]);

  add(message) {
    const timestamp = new Date().toLocaleTimeString();
    this.entries.push({ timestamp, message });
  }

  clear() {
    this.entries = [];
  }
}

export const logState = new LogState();

// Listen for git log messages from main process
if (window.api) {
  window.api.onGitLog((msg) => {
    logState.add(msg);
  });
}

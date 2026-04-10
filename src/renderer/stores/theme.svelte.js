const THEMES = {
  midnight: {
    name: 'Midnight',
    vars: {
      '--bg-base': '#181825',
      '--bg-surface': '#1e1e2e',
      '--bg-overlay': '#11111b',
      '--bg-button': '#313244',
      '--bg-button-hover': '#45475a',
      '--bg-selected': 'rgba(137, 180, 250, 0.1)',
      '--bg-drag-over': 'rgba(137, 180, 250, 0.15)',
      '--bg-item-hover': 'rgba(255, 255, 255, 0.04)',
      '--border': '#313244',
      '--border-hover': '#585b70',
      '--text-primary': '#cdd6f4',
      '--text-secondary': '#a6adc8',
      '--text-tertiary': '#bac2de',
      '--text-muted': '#6c7086',
      '--text-faint': '#45475a',
      '--accent': '#89b4fa',
      '--accent-hover': '#74c7ec',
      '--accent-on': '#1e1e2e',
      '--scrollbar-track': '#1e1e2e',
      '--scrollbar-thumb': '#45475a',
      '--scrollbar-thumb-hover': '#585b70',
      '--input-bg': '#11111b',
      '--input-border': '#313244',
      '--input-border-focus': '#89b4fa',
      '--modal-overlay': 'rgba(0, 0, 0, 0.6)',
      '--code-bg': '#313244',
      '--pre-bg': '#11111b',
      '--blockquote-border': '#45475a',
      '--tag-bg': '#313244',
    }
  },
  dark: {
    name: 'Dark',
    vars: {
      '--bg-base': '#1a1a1a',
      '--bg-surface': '#242424',
      '--bg-overlay': '#111111',
      '--bg-button': '#333333',
      '--bg-button-hover': '#444444',
      '--bg-selected': 'rgba(100, 160, 255, 0.12)',
      '--bg-drag-over': 'rgba(100, 160, 255, 0.15)',
      '--bg-item-hover': 'rgba(255, 255, 255, 0.05)',
      '--border': '#333333',
      '--border-hover': '#555555',
      '--text-primary': '#e0e0e0',
      '--text-secondary': '#aaaaaa',
      '--text-tertiary': '#cccccc',
      '--text-muted': '#777777',
      '--text-faint': '#555555',
      '--accent': '#64a0ff',
      '--accent-hover': '#5090ee',
      '--accent-on': '#111111',
      '--scrollbar-track': '#242424',
      '--scrollbar-thumb': '#444444',
      '--scrollbar-thumb-hover': '#555555',
      '--input-bg': '#111111',
      '--input-border': '#333333',
      '--input-border-focus': '#64a0ff',
      '--modal-overlay': 'rgba(0, 0, 0, 0.65)',
      '--code-bg': '#333333',
      '--pre-bg': '#111111',
      '--blockquote-border': '#444444',
      '--tag-bg': '#333333',
    }
  },
  light: {
    name: 'Light',
    vars: {
      '--bg-base': '#f5f5f5',
      '--bg-surface': '#ffffff',
      '--bg-overlay': '#e8e8e8',
      '--bg-button': '#e0e0e0',
      '--bg-button-hover': '#d0d0d0',
      '--bg-selected': 'rgba(50, 120, 220, 0.1)',
      '--bg-drag-over': 'rgba(50, 120, 220, 0.12)',
      '--bg-item-hover': 'rgba(0, 0, 0, 0.04)',
      '--border': '#d4d4d4',
      '--border-hover': '#b0b0b0',
      '--text-primary': '#1a1a1a',
      '--text-secondary': '#555555',
      '--text-tertiary': '#333333',
      '--text-muted': '#888888',
      '--text-faint': '#bbbbbb',
      '--accent': '#3278dc',
      '--accent-hover': '#2868c8',
      '--accent-on': '#ffffff',
      '--scrollbar-track': '#f0f0f0',
      '--scrollbar-thumb': '#c0c0c0',
      '--scrollbar-thumb-hover': '#a0a0a0',
      '--input-bg': '#f0f0f0',
      '--input-border': '#d4d4d4',
      '--input-border-focus': '#3278dc',
      '--modal-overlay': 'rgba(0, 0, 0, 0.3)',
      '--code-bg': '#e8e8e8',
      '--pre-bg': '#f0f0f0',
      '--blockquote-border': '#d4d4d4',
      '--tag-bg': '#e0e0e0',
    }
  }
};

class ThemeState {
  current = $state('midnight');

  get theme() {
    return THEMES[this.current];
  }

  get list() {
    return Object.entries(THEMES).map(([id, t]) => ({ id, name: t.name }));
  }

  set(themeId) {
    if (!THEMES[themeId]) return;
    this.current = themeId;
    this.apply();
    localStorage.setItem('noteliner-theme', themeId);
  }

  apply() {
    const vars = THEMES[this.current].vars;
    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
  }

  init() {
    const saved = localStorage.getItem('noteliner-theme');
    if (saved && THEMES[saved]) {
      this.current = saved;
    }
    this.apply();
  }
}

export const themeState = new ThemeState();

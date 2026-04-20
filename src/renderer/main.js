import App from './App.svelte';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles/global.css';
import { mount } from 'svelte';
import { themeState } from './stores/theme.svelte.js';

// Apply saved theme + scale before Svelte mounts so CSS vars are already in place
// on first paint — prevents the midnight/100% flash while modules resolve.
themeState.init();

const app = mount(App, { target: document.getElementById('app') });

export default app;

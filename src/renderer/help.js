import HelpApp from './HelpApp.svelte';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles/global.css';
import { mount } from 'svelte';
import { themeState } from './stores/theme.svelte.js';

// Pick up the user's saved theme + scale (shared localStorage across windows)
// before mount so the help window paints with the correct CSS variables.
themeState.init();

const app = mount(HelpApp, { target: document.getElementById('help') });

export default app;

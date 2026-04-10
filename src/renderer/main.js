import App from './App.svelte';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles/global.css';
import { mount } from 'svelte';

const app = mount(App, { target: document.getElementById('app') });

export default app;

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import i18n, { setupI18n } from './i18n';
import './style.css';
import '@/styles/components.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(i18n);

// Mount immediately so the router/stores initialize without waiting for the
// locale chunk. setupI18n runs in the background; App.vue gates the RouterView
// behind isI18nReady so users see a splash instead of raw translation keys.
void setupI18n();

app.mount('#app');

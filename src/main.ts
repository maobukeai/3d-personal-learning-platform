import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import i18n, { setupI18n } from './i18n';
import { installElementPlusLocaleBridge } from './plugins/elementPlusLocale';
import 'element-plus/theme-chalk/base.css';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/message-box/style/css';
import 'element-plus/es/components/notification/style/css';
import './style.css';
import '@/styles/components.css';

// Runtime backdrop-filter support detection.
// Browsers may report @supports(backdrop-filter) as true yet still disable it
// at runtime (power-saving mode, RDP/no-GPU, OS "reduce transparency", etc.).
// We probe by actually creating an element and reading its computed style.
// If the blur is silently dropped to `none`, we fall back to an opaque background.
(function detectBackdropFilter() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-9999px;backdrop-filter:blur(1px);-webkit-backdrop-filter:blur(1px);';
  document.documentElement.appendChild(probe);
  const computed = getComputedStyle(probe).backdropFilter;
  document.documentElement.removeChild(probe);
  const supported = computed && computed !== 'none' && computed !== 'auto';
  document.documentElement.classList.add(supported ? 'bf-supported' : 'bf-unsupported');
})();

await setupI18n();

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(i18n);
installElementPlusLocaleBridge(app, i18n.global.locale);

app.mount('#app');

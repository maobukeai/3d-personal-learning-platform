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

await setupI18n();

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(i18n);
installElementPlusLocaleBridge(app, i18n.global.locale);

app.mount('#app');

import {
  c as defineEventHandler,
  u as useRuntimeConfig,
  p as proxyRequest,
  e as sendRedirect,
} from '../_/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';

const favicon_ico = defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig();
    const settings = await $fetch(`${config.public.apiBase}/auth/settings`);
    const faviconUrl =
      (settings == null ? void 0 : settings.PLATFORM_FAVICON_URL) ||
      (settings == null ? void 0 : settings.PLATFORM_LOGO_URL);
    if (faviconUrl) {
      const path = faviconUrl.startsWith('/') ? faviconUrl : `/${faviconUrl}`;
      return await proxyRequest(event, `http://127.0.0.1:3001${path}`);
    }
  } catch (err) {}
  return sendRedirect(event, '/favicon.svg');
});

export { favicon_ico as default };
//# sourceMappingURL=favicon.ico.mjs.map

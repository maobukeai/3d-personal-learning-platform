import type { AxiosInstance, AxiosProxyConfig } from 'axios';

type ProxyOptions = {
  preferAiProxy?: boolean;
};

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const firstEnv = (...keys: string[]) =>
  keys.map((key) => process.env[key]).find((value): value is string => Boolean(value));

const resolveRequestUrl = (url?: string, baseURL?: string) => {
  if (!url) return null;
  try {
    return new URL(url, baseURL);
  } catch {
    return null;
  }
};

const resolveProxyUrl = (targetUrl: URL, options: ProxyOptions) => {
  const scopedProxy = options.preferAiProxy ? firstEnv('AI_PROXY', 'ai_proxy') : undefined;
  if (scopedProxy) return scopedProxy;

  if (targetUrl.protocol === 'https:') {
    return firstEnv('HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy');
  }
  return firstEnv('HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy');
};

const getProxyForRequest = (
  url?: string,
  baseURL?: string,
  options: ProxyOptions = {},
): AxiosProxyConfig | false | undefined => {
  const targetUrl = resolveRequestUrl(url, baseURL);
  if (!targetUrl) return undefined;

  if (LOOPBACK_HOSTS.has(targetUrl.hostname)) return false;

  const proxyUrl = resolveProxyUrl(targetUrl, options);
  if (!proxyUrl) return undefined;

  try {
    const parsedProxy = new URL(proxyUrl);
    const parsedPort = Number.parseInt(parsedProxy.port, 10);
    const port =
      Number.isFinite(parsedPort) && parsedPort > 0
        ? parsedPort
        : parsedProxy.protocol === 'https:'
          ? 443
          : 80;

    return {
      protocol: parsedProxy.protocol.replace(':', ''),
      host: parsedProxy.hostname,
      port,
      auth:
        parsedProxy.username || parsedProxy.password
          ? {
              username: decodeURIComponent(parsedProxy.username),
              password: decodeURIComponent(parsedProxy.password),
            }
          : undefined,
    };
  } catch (error) {
    console.error('[Proxy Config] Error parsing proxy URL:', error);
    return undefined;
  }
};

export const configureAxiosProxy = (instance: AxiosInstance, options: ProxyOptions = {}) => {
  instance.interceptors.request.use((config) => {
    const proxy = getProxyForRequest(config.url, config.baseURL, options);
    if (proxy !== undefined) {
      config.proxy = proxy;
    }
    return config;
  });
};

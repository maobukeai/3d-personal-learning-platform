import { logger } from '../utils/logger';
import type { AxiosError, AxiosProxyConfig } from 'axios';

/** Extracts a human-readable error message from an Axios error. */
export const resolveAxiosErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosErr = error as AxiosError<{
      error_description?: string;
      error?: { message?: string };
    }>;
    const desc = axiosErr.response?.data?.error_description;
    if (desc) return desc;
    const msg = axiosErr.response?.data?.error?.message;
    if (msg) return msg;
  }
  if (error instanceof Error) return error.message;
  return String(error) || fallback;
};

/** Extracts the HTTP status code from an Axios error, if available. */
export const resolveAxiosErrorStatus = (error: unknown): number | undefined => {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosErr = error as AxiosError;
    return axiosErr.response?.status;
  }
  return undefined;
};

/** Helper to parse a proxy URL string into an Axios-compatible proxy configuration object */
export const parseProxy = (proxyUrl: string | null): AxiosProxyConfig | undefined => {
  if (!proxyUrl) return undefined;
  try {
    const url = new URL(proxyUrl);
    const config: AxiosProxyConfig = {
      protocol: url.protocol.replace(':', ''),
      host: url.hostname,
      port: parseInt(url.port, 10) || (url.protocol === 'https:' ? 443 : 80),
    };
    if (url.username) {
      config.auth = {
        username: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password || ''),
      };
    }
    return config;
  } catch (e) {
    logger.error('MicrosoftGraphHelper: Error parsing proxy URL', e);
    return undefined;
  }
};

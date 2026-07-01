/**
 * Type-safe error handling utilities for API calls.
 * Replaces the `catch (error)` anti-pattern with proper unknown type handling.
 */

/** Shape of an Axios error response */
interface AxiosLikeError {
  response?: {
    data?: {
      error?: string;
      details?: string;
      message?: string;
    };
    status?: number;
    statusText?: string;
  };
  message?: string;
}

/**
 * Extracts a user-friendly error message from an unknown catch variable.
 * Handles Axios errors, standard Error objects, and plain strings.
 *
 * @param error - The caught error (unknown type)
 * @param fallback - Default message if no meaningful message can be extracted
 * @returns A human-readable error string
 */
export function getApiErrorMessage(error: unknown, fallback = '操作失败'): string {
  if (typeof error === 'string') return error;

  if (error && typeof error === 'object') {
    const err = error as AxiosLikeError;
    if (err.response?.data?.error) {
      const details = err.response.data.details;
      if (details) return `${err.response.data.error} (${details})`;
      return err.response.data.error;
    }
    if (err.response?.data?.details) return err.response.data.details;
    if (err.response?.data?.message) return err.response.data.message;
    if (err.message) return err.message;
  }

  if (error instanceof Error) return error.message;

  return fallback;
}

/**
 * Extracts the HTTP status code from an Axios-like error.
 *
 * @param error - The caught error (unknown type)
 * @returns The HTTP status code, or undefined if not available
 */
export function getApiErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const err = error as AxiosLikeError;
    return err.response?.status;
  }
  return undefined;
}

/** Context attached to an error report */
export interface ErrorContext {
  [key: string]: unknown;
}

/** Optional reporter configuration */
interface ErrorReporterConfig {
  endpoint?: string;
  enabled?: boolean;
  sampleRate?: number;
}

let reporterConfig: ErrorReporterConfig = {
  endpoint: import.meta.env.VITE_ERROR_REPORT_ENDPOINT,
  enabled: import.meta.env.PROD,
  sampleRate: 1,
};

function buildReportPayload(error: unknown, context?: ErrorContext): object {
  return {
    message: getApiErrorMessage(error, 'Unknown error'),
    status: getApiErrorStatus(error),
    context,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    timestamp: new Date().toISOString(),
  };
}

async function sendReport(payload: object): Promise<void> {
  if (!reporterConfig.enabled || !reporterConfig.endpoint) return;
  if (reporterConfig.sampleRate !== undefined && Math.random() > reporterConfig.sampleRate) return;

  try {
    await fetch(reporterConfig.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Silently ignore reporting failures to avoid loops
  }
}

/**
 * Logs an error in a centralized way.
 * In development, prints to the console. In production, optionally reports to a remote endpoint.
 *
 * @param error - The error to log
 * @param context - Additional context to include in the report
 */
export function logError(error: unknown, context?: ErrorContext): void {
  if (import.meta.env.DEV) {
    console.error('[Error]', error, context);
  }
  void sendReport(buildReportPayload(error, context));
}

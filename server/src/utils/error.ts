export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(message: string, statusCode = 500, code = 'APP_ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function formatError(error: unknown) {
  if (error instanceof AppError) {
    return {
      status: 'error',
      success: false,
      error: error.message,
      message: error.message,
      code: error.code,
      ...(error.details !== undefined && { details: error.details }),
    };
  }
  return {
    status: 'error',
    success: false,
    error: 'Internal server error',
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
  };
}

export function successResponse(data: unknown, message: string = 'Success') {
  return {
    success: true,
    message,
    data,
  };
}

/**
 * Extracts a meaningful error message from an unknown catch variable.
 * Handles AppError, standard Error, Axios-like errors, and plain strings.
 */
export function getErrorMessage(error: unknown, fallback = 'An error occurred'): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const err = error as { message?: string };
    if (err.message) return err.message;
  }
  return fallback;
}

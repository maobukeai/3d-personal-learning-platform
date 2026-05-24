export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function formatError(error: unknown) {
  if (error instanceof AppError) {
    return {
      success: false,
      message: error.message,
      code: error.code,
    };
  }
  return {
    success: false,
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

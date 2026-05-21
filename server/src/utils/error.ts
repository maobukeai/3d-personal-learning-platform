export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function formatError(error: any) {
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

export function successResponse(data: any, message: string = 'Success') {
  return {
    success: true,
    message,
    data,
  };
}

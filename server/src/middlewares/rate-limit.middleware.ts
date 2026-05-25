import { Request, Response } from 'express';

export const createRateLimitHandler = (message: string, code = 'RATE_LIMITED') => {
  return (req: Request, res: Response) => {
    const requestId = (req as Request & { requestId?: string }).requestId;

    res.status(429).json({
      status: 'error',
      error: message,
      message,
      code,
      ...(requestId && { requestId }),
    });
  };
};

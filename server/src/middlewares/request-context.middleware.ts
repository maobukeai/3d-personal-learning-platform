import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,128}$/;

const getRequestId = (req: Request) => {
  const header = req.headers['x-request-id'];
  const value = Array.isArray(header) ? header[0] : header;

  if (value && REQUEST_ID_PATTERN.test(value)) {
    return value;
  }

  return randomUUID();
};

export const requestContext = (req: Request, res: Response, next: NextFunction) => {
  const requestId = getRequestId(req);
  (req as Request & { requestId: string }).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
};

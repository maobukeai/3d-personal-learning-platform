import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/error';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(`接口不存在: ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND'));
};

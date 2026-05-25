import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';

type ValidationRule = {
  type: 'string' | 'number' | 'email' | 'boolean' | 'array';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  message?: string;
};

type ValidationSchema = {
  [field: string]: ValidationRule;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateField = (value: any, rule: ValidationRule, field: string): string | null => {
  if (value === undefined || value === null || value === '') {
    if (rule.required) {
      return rule.message || `${field} 为必填项`;
    }
    return null;
  }

  switch (rule.type) {
    case 'string':
      if (typeof value !== 'string') return rule.message || `${field} 必须为字符串`;
      if (rule.minLength && value.length < rule.minLength)
        return rule.message || `${field} 长度不能少于 ${rule.minLength}`;
      if (rule.maxLength && value.length > rule.maxLength)
        return rule.message || `${field} 长度不能超过 ${rule.maxLength}`;
      if (rule.pattern && !rule.pattern.test(value)) return rule.message || `${field} 格式不正确`;
      break;
    case 'number':
      if (typeof value !== 'number' && isNaN(Number(value)))
        return rule.message || `${field} 必须为数字`;
      const num = Number(value);
      if (rule.min !== undefined && num < rule.min)
        return rule.message || `${field} 不能小于 ${rule.min}`;
      if (rule.max !== undefined && num > rule.max)
        return rule.message || `${field} 不能大于 ${rule.max}`;
      break;
    case 'email':
      if (typeof value !== 'string' || !EMAIL_REGEX.test(value))
        return rule.message || `${field} 邮箱格式不正确`;
      break;
    case 'boolean':
      if (typeof value !== 'boolean') return rule.message || `${field} 必须为布尔值`;
      break;
    case 'array':
      if (!Array.isArray(value)) return rule.message || `${field} 必须为数组`;
      break;
  }

  return null;
};

export const validate = (schema: ValidationSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: string[] = [];

    for (const [field, rule] of Object.entries(schema)) {
      const value = req.body[field];
      const error = validateField(value, rule, field);
      if (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      return next(new AppError(errors.join('; '), 400, 'VALIDATION_ERROR', errors));
    }

    next();
  };
};

export const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    }
  }
  next();
};

import { Request } from 'express';
import prisma from './prisma';

export enum AuditModule {
  SETTINGS = 'SETTINGS',
  USER = 'USER',
  ASSET = 'ASSET',
  COURSE = 'COURSE',
  TEAM = 'TEAM',
  MATERIAL = 'MATERIAL',
  SHOWCASE = 'SHOWCASE',
  AUTH = 'AUTH'
}

export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  UPDATE_SETTINGS = 'UPDATE_SETTINGS',
  CREATE_USER = 'CREATE_USER',
  UPDATE_USER = 'UPDATE_USER',
  DELETE_USER = 'DELETE_USER',
  RESET_PASSWORD = 'RESET_PASSWORD',
  APPROVE_ASSET = 'APPROVE_ASSET',
  REJECT_ASSET = 'REJECT_ASSET',
  DELETE_ASSET = 'DELETE_ASSET',
  CREATE_COURSE = 'CREATE_COURSE',
  UPDATE_COURSE = 'UPDATE_COURSE',
  DELETE_COURSE = 'DELETE_COURSE',
  APPROVE_MATERIAL = 'APPROVE_MATERIAL',
  REJECT_MATERIAL = 'REJECT_MATERIAL',
  APPROVE_SHOWCASE = 'APPROVE_SHOWCASE',
  REJECT_SHOWCASE = 'REJECT_SHOWCASE',
}

interface AuditParams {
  userId?: string;
  action: AuditAction | string;
  module: AuditModule | string;
  description?: string;
  oldValue?: any;
  newValue?: any;
  req?: Request;
  tx?: any; // Add optional transaction client
}

class AuditService {
  async log({ userId, action, module, description, oldValue, newValue, req, tx }: AuditParams) {
    const client = tx || prisma; // Use transaction client if provided
    try {
      await client.auditLog.create({
        data: {
          userId,
          action,
          module,
          description,
          oldValue: oldValue ? JSON.stringify(oldValue) : null,
          newValue: newValue ? JSON.stringify(newValue) : null,
          ipAddress: req?.ip || req?.headers['x-forwarded-for']?.toString() || null,
          userAgent: req?.headers['user-agent'] || null,
        }
      });
    } catch (error) {
      console.error('[AuditService] Failed to create audit log:', error);
    }
  }
}

export const auditService = new AuditService();

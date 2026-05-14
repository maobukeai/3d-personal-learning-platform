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
  AUTH = 'AUTH',
  PROJECT = 'PROJECT',
  TASK = 'TASK'
}

export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  UPDATE_SETTINGS = 'UPDATE_SETTINGS',
  CREATE_USER = 'CREATE_USER',
  UPDATE_USER = 'UPDATE_USER',
  DELETE_USER = 'DELETE_USER',
  RESET_PASSWORD = 'RESET_PASSWORD',
  CREATE_ASSET = 'CREATE_ASSET',
  UPDATE_ASSET = 'UPDATE_ASSET',
  DELETE_ASSET = 'DELETE_ASSET',
  APPROVE_ASSET = 'APPROVE_ASSET',
  REJECT_ASSET = 'REJECT_ASSET',
  CREATE_COURSE = 'CREATE_COURSE',
  UPDATE_COURSE = 'UPDATE_COURSE',
  DELETE_COURSE = 'DELETE_COURSE',
  CREATE_MATERIAL = 'CREATE_MATERIAL',
  DELETE_MATERIAL = 'DELETE_MATERIAL',
  APPROVE_MATERIAL = 'APPROVE_MATERIAL',
  REJECT_MATERIAL = 'REJECT_MATERIAL',
  CREATE_SHOWCASE = 'CREATE_SHOWCASE',
  DELETE_SHOWCASE = 'DELETE_SHOWCASE',
  APPROVE_SHOWCASE = 'APPROVE_SHOWCASE',
  REJECT_SHOWCASE = 'REJECT_SHOWCASE',
  CREATE_TEAM = 'CREATE_TEAM',
  DELETE_TEAM = 'DELETE_TEAM',
  CREATE_PROJECT = 'CREATE_PROJECT',
  UPDATE_PROJECT = 'UPDATE_PROJECT',
  DELETE_PROJECT = 'DELETE_PROJECT',
  CREATE_TASK = 'CREATE_TASK',
  UPDATE_TASK = 'UPDATE_TASK',
  DELETE_TASK = 'DELETE_TASK',
  ENROLL_COURSE = 'ENROLL_COURSE',
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
      // Robust IP detection
      let ipAddress: string | null = null;
      
      if (req) {
        // Priority: 1. X-Forwarded-For, 2. X-Real-IP, 3. req.ip, 4. remoteAddress
        const xForwardedFor = req.headers['x-forwarded-for'];
        if (xForwardedFor) {
          ipAddress = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(',')[0].trim();
        }
        
        if (!ipAddress || ipAddress === 'unknown') {
          ipAddress = (req.headers['x-real-ip'] as string) || 
                      (req.headers['cf-connecting-ip'] as string) || 
                      (req.headers['true-client-ip'] as string) ||
                      req.ip || 
                      null;
        }

        if (!ipAddress && req.socket) {
          ipAddress = req.socket.remoteAddress || null;
        }
      }

      // Normalize local addresses
      if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
        ipAddress = '127.0.0.1';
      }

      // Debug logging to help troubleshoot if IPs are still missing
      if (!ipAddress && req) {
        console.warn(`[AuditService] Could not detect IP address. Headers: ${JSON.stringify(req.headers)}`);
      }

      await client.auditLog.create({
        data: {
          userId,
          action,
          module,
          description,
          oldValue: oldValue ? JSON.stringify(oldValue) : null,
          newValue: newValue ? JSON.stringify(newValue) : null,
          ipAddress: ipAddress,
          userAgent: req?.headers['user-agent'] || null,
        }
      });
    } catch (error) {
      console.error('[AuditService] Failed to create audit log:', error);
    }
  }
}

export const auditService = new AuditService();

import { logger } from '../../utils/logger';
import { Response, NextFunction } from 'express';
import dns from 'dns';
import nodemailer from 'nodemailer';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { settingsService } from '../../services/settings.service';
import { auditService, AuditModule, AuditAction } from '../../services/audit.service';
import { AppError } from '../../middlewares/error.middleware';

import { config as envConfig } from '../../config/env';

/**
 * 自定义 DNS 查找：支持动态配置 DNS 服务器绕过 TUN Fake-IP 劫持
 * 默认使用系统 DNS lookup，若提供 DNS_SERVERS 环境变量则使用其指定的 DNS 查询
 */
function resolveSmtpRealIp(hostname: string): Promise<string> {
  return new Promise((resolve) => {
    const dnsServers = process.env.DNS_SERVERS;
    if (dnsServers) {
      try {
        const servers = dnsServers
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (servers.length > 0) {
          const resolver = new dns.Resolver();
          resolver.setServers(servers);
          resolver.resolve4(hostname, (err, addresses) => {
            if (!err && addresses && addresses.length > 0) {
              resolve(addresses[0] || hostname);
            } else {
              resolve(hostname);
            }
          });
          return;
        }
      } catch (err) {
        logger.error('[SMTP DNS Resolve Warning]: Failed to use DNS_SERVERS env, falling back to dns.lookup', err);
      }
    }

    dns.lookup(hostname, (err, address) => {
      if (!err && address) {
        resolve(address);
      } else {
        resolve(hostname);
      }
    });
  });
}

const validateSettings = (
  settingsObj: Record<string, unknown>,
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  const numericFields = [
    { key: 'MAX_FILE_SIZE', min: 1, max: 1024, label: '最大文件大小' },
    { key: 'MAX_UPLOAD_SIZE_MB', min: 1, max: 1024, label: '最大上传大小' },
    { key: 'SMTP_PORT', min: 1, max: 65535, label: 'SMTP端口' },
    { key: 'PASSWORD_MIN_LENGTH', min: 4, max: 128, label: '密码最小长度' },
  ];

  for (const { key, min, max, label } of numericFields) {
    if (settingsObj[key] !== undefined) {
      const value = parseInt(String(settingsObj[key]), 10);
      if (isNaN(value)) {
        errors.push(`${label}必须是数字`);
      } else if (value < min || value > max) {
        errors.push(`${label}必须在 ${min}-${max} 范围内`);
      }
    }
  }

  const booleanFields = [
    'ALLOW_REGISTRATION',
    'MAINTENANCE_MODE',
    'AUTO_APPROVE_MATERIALS',
    'AUTO_APPROVE_SHOWCASES',
    'OAUTH_GOOGLE_ENABLED',
    'OAUTH_GITHUB_ENABLED',
    'MICROSOFT_POOL_FAILBACK',
  ];

  for (const field of booleanFields) {
    if (settingsObj[field] !== undefined) {
      const val = settingsObj[field];
      if (val !== true && val !== false && val !== 'true' && val !== 'false') {
        errors.push(`${field}必须是布尔值`);
      }
    }
  }

  if (settingsObj.SYSTEM_EMAIL_PROVIDER !== undefined) {
    const validProviders = ['SMTP', 'MICROSOFT_POOL'];
    if (!validProviders.includes(settingsObj.SYSTEM_EMAIL_PROVIDER as string)) {
      errors.push('SYSTEM_EMAIL_PROVIDER必须是 SMTP 或 MICROSOFT_POOL');
    }
  }

  if (settingsObj.SESSION_TIMEOUT !== undefined) {
    const timeout = settingsObj.SESSION_TIMEOUT as string;
    if (!/^\d+[hdwm]$/.test(timeout)) {
      errors.push('SESSION_TIMEOUT格式不正确，应为数字加单位(如: 7d, 1h)');
    }
  }

  if (settingsObj.DEFAULT_USER_ROLE !== undefined) {
    const validRoles = ['USER', 'ADMIN', 'INSTRUCTOR'];
    if (!validRoles.includes(settingsObj.DEFAULT_USER_ROLE as string)) {
      errors.push('DEFAULT_USER_ROLE必须是 USER、ADMIN 或 INSTRUCTOR');
    }
  }

  return { valid: errors.length === 0, errors };
};

export const getSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await settingsService.getAll();
    res.json(settings);
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { settings } = req.body; // Expecting { key: value, ... } or [{key, value}, ...]

    if (!settings || (Array.isArray(settings) && settings.length === 0)) {
      return next(new AppError('设置数据不能为空', 400));
    }

    const oldSettings = await settingsService.getAll();
    let settingsObj: Record<string, unknown> = {};

    if (Array.isArray(settings)) {
      settings.forEach((s: { key: string; value: unknown }) => {
        if (s.key && s.value !== undefined) {
          settingsObj[s.key] = s.value;
        }
      });
    } else {
      settingsObj = settings;
    }

    const { valid, errors } = validateSettings(settingsObj);
    if (!valid) {
      return next(new AppError(`设置验证失败: ${errors.join(', ')}`, 400));
    }

    // Ensure array fields are actually arrays before saving
    const arrayFields = ['ALLOWED_EXTENSIONS', 'ALLOWED_FILE_TYPES', 'MATERIAL_CATEGORIES'];
    arrayFields.forEach((field) => {
      if (settingsObj[field] !== undefined) {
        if (typeof settingsObj[field] === 'string') {
          const valStr = settingsObj[field].trim();
          if (valStr.startsWith('[')) {
            try {
              let parsed = JSON.parse(valStr);
              while (typeof parsed === 'string' && parsed.trim().startsWith('[')) {
                parsed = JSON.parse(parsed);
              }
              if (Array.isArray(parsed)) {
                settingsObj[field] = parsed;
              } else {
                settingsObj[field] = valStr
                  .split(',')
                  .map((s: string) => s.trim())
                  .filter(Boolean);
              }
            } catch (e) {
              settingsObj[field] = valStr
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean);
            }
          } else {
            settingsObj[field] = valStr
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean);
          }
        }
      }
    });

    await settingsService.updateMany(settingsObj);

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_SETTINGS,
      module: AuditModule.SETTINGS,
      description: '管理员更新了全局系统设置',
      oldValue: oldSettings,
      newValue: settingsObj,
      req,
    });

    res.json({ message: '设置已成功保存' });
  } catch (error) {
    next(error);
  }
};

export const testSmtp = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { host, port, user, pass, from, secure, to } = req.body;

    if (!host || !user || !pass) {
      return next(new AppError('SMTP 配置不完整', 400));
    }

    const isSecure = secure === true || secure === 'true';
    const portNum = parseInt(port) || 465;

    const realIp = await resolveSmtpRealIp(host);
    logger.info(
      `[SMTP Test] Attempting connection: ${host}(${realIp}):${portNum}, secure: ${isSecure}`,
    );

    const transporter = nodemailer.createTransport({
      host: realIp,
      port: portNum,
      secure: isSecure,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: envConfig.NODE_ENV === 'production',
        minVersion: 'TLSv1.2',
        servername: host,
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
    });

    // Detailed verification
    await transporter.verify().catch((err) => {
      logger.error('[SMTP Verify Error]:', err);
      throw err;
    });

    const admin = req.user;

    await transporter.sendMail({
      from: from || user,
      to: to || from || user || admin?.email,
      subject: 'SMTP 测试邮件',
      text: '如果您收到这封邮件，说明您的 SMTP 配置已成功！',
      html: `<h3>SMTP 配置测试成功</h3><p>如果您收到这封邮件，说明您的 SMTP 配置已成功！</p><p>测试时间: ${new Date().toLocaleString()}</p>`,
    });

    res.json({ message: 'SMTP 连接测试成功，已向您的邮箱发送测试邮件' });
  } catch (error) {
    logger.error('SMTP Test Error Detail:', error);
    let errorMsg = (error instanceof Error ? error.message : String(error)) || '未知错误';

    // Detailed error mapping
    if ((error as { code?: string }).code === 'ECONNRESET')
      errorMsg = '连接被重置。通常是因为网络防火墙拦截或 SSL/TLS 协议不匹配。';
    else if ((error as { code?: string }).code === 'ETIMEDOUT')
      errorMsg = '连接超时。请检查 465/587 端口是否在云服务器安全组中开放。';
    else if ((error as { code?: string }).code === 'ECONNREFUSED')
      errorMsg = '连接被拒绝。目标服务器可能不可达，或端口被本地 ISP 封锁。';
    else if ((error as { code?: string }).code === 'EAUTH')
      errorMsg = '验证失败。请确保您使用的是 Gmail 的 16 位“应用专用密码”而非主密码。';
    else if ((error instanceof Error ? error.message : String(error)).includes('secure TLS connection'))
      errorMsg = 'TLS 握手失败。请尝试切换 465 (勾选 SSL) 或 587 (取消勾选 SSL)。';

    next(new AppError(`SMTP 连接失败: ${errorMsg}`, 500));
  }
};

export const uploadBrandingLogo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    const fileUrl = `/uploads/branding/${req.file.filename}`;
    res.json({ url: fileUrl });
  } catch (error) {
    next(error);
  }
};

export const uploadBrandingFavicon = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    const fileUrl = `/uploads/branding/${req.file.filename}`;
    res.json({ url: fileUrl });
  } catch (error) {
    next(error);
  }
};

export const cleanupStorage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { cleanupOrphanedFiles } = await import('../../scripts/cleanup-storage');
    const stats = await cleanupOrphanedFiles();
    res.json({
      message: '存储空间清理完成',
      stats,
    });
  } catch (error) {
    next(new AppError('清理存储空间失败: ' + (error instanceof Error ? error.message : String(error)), 500));
  }
};

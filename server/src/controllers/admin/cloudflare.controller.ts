import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { cloudflareAdminService } from '../../services/cloudflare-admin.service';
import { auditService, AuditModule } from '../../services/audit.service';
import { AppError } from '../../utils/error';

export const getConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const config = await cloudflareAdminService.getConfig();
    res.json({
      accountId: config.accountId,
      hasToken: config.hasToken,
      apiToken: config.hasToken ? '********' : '',
    });
  } catch (error) {
    next(error);
  }
};

export const saveConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { apiToken, accountId } = req.body as { apiToken?: string; accountId?: string | null };
    const existing = await cloudflareAdminService.getConfig();

    if (!apiToken?.trim() && !existing.hasToken) {
      return next(new AppError('请填写 Cloudflare API Token', 400));
    }

    const saved = await cloudflareAdminService.saveConfig(
      apiToken?.trim() || existing.apiToken,
      accountId ?? null,
    );

    await auditService.log({
      req,
      userId: req.userId!,
      module: AuditModule.SETTINGS,
      action: 'SAVE_CLOUDFLARE_DOMAIN_CONFIG',
      description: 'Saved Cloudflare domain management API token',
      newValue: { hasToken: true, accountId: saved.accountId },
    });

    res.json({
      accountId: saved.accountId,
      hasToken: saved.hasToken,
      apiToken: '********',
    });
  } catch (error) {
    next(error);
  }
};

export const clearConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await cloudflareAdminService.clearConfig();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { apiToken } = req.body as { apiToken?: string };
    const token = apiToken?.trim() || (await cloudflareAdminService.getConfig()).apiToken;
    if (!token) {
      return next(new AppError('请填写 Cloudflare API Token', 400));
    }

    const result = await cloudflareAdminService.verifyToken(token);
    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
};

export const listZones = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const zones = await cloudflareAdminService.listZones();
    res.json(zones);
  } catch (error) {
    next(error);
  }
};

export const getZone = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const zoneId = req.params.zoneId as string;
    const zone = await cloudflareAdminService.getZone(zoneId);
    res.json(zone);
  } catch (error) {
    next(error);
  }
};

export const listDnsRecords = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const zoneId = req.params.zoneId as string;
    const records = await cloudflareAdminService.listDnsRecords(zoneId);
    res.json(records);
  } catch (error) {
    next(error);
  }
};

export const createDnsRecord = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const zoneId = req.params.zoneId as string;
    const { type, name, content } = req.body;
    if (!type || !name) {
      return next(new AppError('缺少 DNS 记录必要字段', 400));
    }

    const record = await cloudflareAdminService.createDnsRecord(zoneId, req.body);

    await auditService.log({
      req,
      userId: req.userId!,
      module: AuditModule.SETTINGS,
      action: 'CREATE_CLOUDFLARE_DNS_RECORD',
      description: `Created DNS record ${type} ${name} in zone ${zoneId}`,
      newValue: { zoneId, type, name, content: content || '(Data-based)' },
    });

    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
};

export const updateDnsRecord = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const zoneId = req.params.zoneId as string;
    const recordId = req.params.recordId as string;
    const { type, name, content } = req.body;

    const record = await cloudflareAdminService.updateDnsRecord(zoneId, recordId, req.body);

    await auditService.log({
      req,
      userId: req.userId!,
      module: AuditModule.SETTINGS,
      action: 'UPDATE_CLOUDFLARE_DNS_RECORD',
      description: `Updated DNS record ${recordId} in zone ${zoneId}`,
      newValue: { zoneId, recordId, type, name, content: content || '(Data-based)' },
    });

    res.json(record);
  } catch (error) {
    next(error);
  }
};

export const deleteDnsRecord = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const zoneId = req.params.zoneId as string;
    const recordId = req.params.recordId as string;

    await cloudflareAdminService.deleteDnsRecord(zoneId, recordId);

    await auditService.log({
      req,
      userId: req.userId!,
      module: AuditModule.SETTINGS,
      action: 'DELETE_CLOUDFLARE_DNS_RECORD',
      description: `Deleted DNS record ${recordId} in zone ${zoneId}`,
      oldValue: { zoneId, recordId },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const getZoneSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const zoneId = req.params.zoneId as string;
    const settings = await cloudflareAdminService.getZoneSettings(zoneId);
    res.json(settings);
  } catch (error) {
    next(error);
  }
};

export const updateZonePause = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const zoneId = req.params.zoneId as string;
    const { paused } = req.body as { paused?: boolean };
    if (typeof paused !== 'boolean') {
      return next(new AppError('缺少 paused 参数', 400));
    }

    const zone = await cloudflareAdminService.setZonePaused(zoneId, paused);

    await auditService.log({
      req,
      userId: req.userId!,
      module: AuditModule.SETTINGS,
      action: paused ? 'PAUSE_CLOUDFLARE_ZONE' : 'RESUME_CLOUDFLARE_ZONE',
      description: `${paused ? 'Paused' : 'Resumed'} Cloudflare zone ${zoneId}`,
      newValue: { zoneId, paused },
    });

    res.json({ success: true, paused: zone.paused, status: zone.status });
  } catch (error) {
    next(error);
  }
};

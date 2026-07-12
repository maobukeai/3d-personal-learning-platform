import type { FastifyRequest, FastifyReply } from 'fastify';

import { cloudflareAdminService } from '../../services/cloudflare-admin.service';
import { auditService, AuditModule, type AuditRequest } from '../../services/audit.service';
import { AppError } from '../../utils/error';

type AdminRequest = FastifyRequest & {
  body: any;
  query: any;
  params: any;
  file?: any;
};

export const getConfig = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const config = await cloudflareAdminService.getConfig();
    reply.send({
      accountId: config.accountId,
      hasToken: config.hasToken,
      apiToken: config.hasToken ? '********' : '',
    });
  } catch (error) {
    throw error;
  }
};

export const revealConfigSecrets = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const config = await cloudflareAdminService.getConfig();
    reply.send({
      apiToken: config.apiToken,
    });
  } catch (error) {
    throw error;
  }
};

export const saveConfig = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const { apiToken, accountId } = req.body as { apiToken?: string; accountId?: string | null };
    const existing = await cloudflareAdminService.getConfig();
    const inputToken = apiToken?.trim();
    const tokenToSave = inputToken === '********' || !inputToken ? existing.apiToken : inputToken;

    if (!tokenToSave && !existing.hasToken) {
      throw new AppError('请填写 Cloudflare API Token', 400);
    }

    const saved = await cloudflareAdminService.saveConfig(tokenToSave, accountId ?? null);

    await auditService.log({
      req: req as unknown as AuditRequest,
      userId: req.userId!,
      module: AuditModule.SETTINGS,
      action: 'SAVE_CLOUDFLARE_DOMAIN_CONFIG',
      description: 'Saved Cloudflare domain management API token',
      newValue: { hasToken: true, accountId: saved.accountId },
    });

    reply.send({
      accountId: saved.accountId,
      hasToken: saved.hasToken,
      apiToken: '********',
    });
  } catch (error) {
    throw error;
  }
};

export const clearConfig = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    await cloudflareAdminService.clearConfig();
    reply.send({ success: true });
  } catch (error) {
    throw error;
  }
};

export const verifyToken = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const { apiToken } = req.body as { apiToken?: string };
    const token = apiToken?.trim() || (await cloudflareAdminService.getConfig()).apiToken;
    if (!token) {
      throw new AppError('请填写 Cloudflare API Token', 400);
    }

    const result = await cloudflareAdminService.verifyToken(token);
    reply.send({ success: true, result });
  } catch (error) {
    throw error;
  }
};

export const listZones = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const zones = await cloudflareAdminService.listZones();
    reply.send(zones);
  } catch (error) {
    throw error;
  }
};

export const getZone = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const zoneId = req.params.zoneId as string;
    const zone = await cloudflareAdminService.getZone(zoneId);
    reply.send(zone);
  } catch (error) {
    throw error;
  }
};

export const listDnsRecords = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const zoneId = req.params.zoneId as string;
    const records = await cloudflareAdminService.listDnsRecords(zoneId);
    reply.send(records);
  } catch (error) {
    throw error;
  }
};

export const createDnsRecord = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const zoneId = req.params.zoneId as string;
    const { type, name, content } = req.body;
    if (!type || !name) {
      throw new AppError('缺少 DNS 记录必要字段', 400);
    }

    const record = await cloudflareAdminService.createDnsRecord(zoneId, req.body);

    await auditService.log({
      req: req as unknown as AuditRequest,
      userId: req.userId!,
      module: AuditModule.SETTINGS,
      action: 'CREATE_CLOUDFLARE_DNS_RECORD',
      description: `Created DNS record ${type} ${name} in zone ${zoneId}`,
      newValue: { zoneId, type, name, content: content || '(Data-based)' },
    });

    reply.status(201).send(record);
  } catch (error) {
    throw error;
  }
};

export const updateDnsRecord = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const zoneId = req.params.zoneId as string;
    const recordId = req.params.recordId as string;
    const { type, name, content } = req.body;

    const record = await cloudflareAdminService.updateDnsRecord(zoneId, recordId, req.body);

    await auditService.log({
      req: req as unknown as AuditRequest,
      userId: req.userId!,
      module: AuditModule.SETTINGS,
      action: 'UPDATE_CLOUDFLARE_DNS_RECORD',
      description: `Updated DNS record ${recordId} in zone ${zoneId}`,
      newValue: { zoneId, recordId, type, name, content: content || '(Data-based)' },
    });

    reply.send(record);
  } catch (error) {
    throw error;
  }
};

export const deleteDnsRecord = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const zoneId = req.params.zoneId as string;
    const recordId = req.params.recordId as string;

    await cloudflareAdminService.deleteDnsRecord(zoneId, recordId);

    await auditService.log({
      req: req as unknown as AuditRequest,
      userId: req.userId!,
      module: AuditModule.SETTINGS,
      action: 'DELETE_CLOUDFLARE_DNS_RECORD',
      description: `Deleted DNS record ${recordId} in zone ${zoneId}`,
      oldValue: { zoneId, recordId },
    });

    reply.send({ success: true });
  } catch (error) {
    throw error;
  }
};

export const getZoneSettings = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const zoneId = req.params.zoneId as string;
    const settings = await cloudflareAdminService.getZoneSettings(zoneId);
    reply.send(settings);
  } catch (error) {
    throw error;
  }
};

export const updateZonePause = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const zoneId = req.params.zoneId as string;
    const { paused } = req.body as { paused?: boolean };
    if (typeof paused !== 'boolean') {
      throw new AppError('缺少 paused 参数', 400);
    }

    const zone = await cloudflareAdminService.setZonePaused(zoneId, paused);

    await auditService.log({
      req: req as unknown as AuditRequest,
      userId: req.userId!,
      module: AuditModule.SETTINGS,
      action: paused ? 'PAUSE_CLOUDFLARE_ZONE' : 'RESUME_CLOUDFLARE_ZONE',
      description: `${paused ? 'Paused' : 'Resumed'} Cloudflare zone ${zoneId}`,
      newValue: { zoneId, paused },
    });

    reply.send({ success: true, paused: zone.paused, status: zone.status });
  } catch (error) {
    throw error;
  }
};

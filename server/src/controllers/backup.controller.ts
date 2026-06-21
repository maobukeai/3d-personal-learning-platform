import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../services/prisma';
import { WebDAVClient } from '../utils/webdav';
import { encryptSecret, decryptSecret } from '../utils/secret-field';
import { encrypt, decryptSecretIfNeeded } from '../utils/crypto';
import { logger } from '../utils/logger';
import archiver from 'archiver';
import unzipper from 'unzipper';
import fs from 'fs';
import path from 'path';

/**
 * Get WebDAV config helper
 */
const getWebDAVConfig = async (userId: string) => {
  const settings = await prisma.userSetting.findMany({
    where: {
      userId,
      key: {
        in: [
          'WEBDAV_URL',
          'WEBDAV_USERNAME',
          'WEBDAV_PASSWORD',
          'WEBDAV_DIR',
          'WEBDAV_RETENTION_DAYS',
        ],
      },
    },
  });

  const configMap = settings.reduce(
    (acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    },
    {} as Record<string, string>,
  );

  return {
    url: configMap['WEBDAV_URL'] || '',
    username: configMap['WEBDAV_USERNAME'] || '',
    password: configMap['WEBDAV_PASSWORD'] ? decryptSecret(configMap['WEBDAV_PASSWORD']) || '' : '',
    dir: configMap['WEBDAV_DIR'] || '3d-learning-platform-backups',
    retentionDays: configMap['WEBDAV_RETENTION_DAYS']
      ? parseInt(configMap['WEBDAV_RETENTION_DAYS'], 10)
      : 15,
  };
};

/**
 * Retrieve WebDAV config for client
 */
export const getBackupConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.userId as string;
  try {
    const config = await getWebDAVConfig(userId);
    // Mask password
    res.json({
      url: config.url,
      username: config.username,
      dir: config.dir,
      retentionDays: config.retentionDays,
      hasPassword: !!config.password,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Save WebDAV config
 */
export const saveBackupConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.userId as string;
  const { url, username, password, dir, retentionDays } = req.body;

  try {
    const upsertSetting = async (key: string, value: string) => {
      await prisma.userSetting.upsert({
        where: { userId_key: { userId, key } },
        update: { value },
        create: { userId, key, value },
      });
    };

    if (url !== undefined) await upsertSetting('WEBDAV_URL', url);
    if (username !== undefined) await upsertSetting('WEBDAV_USERNAME', username);
    if (password !== undefined && password !== '') {
      await upsertSetting('WEBDAV_PASSWORD', encryptSecret(password) || '');
    }
    if (dir !== undefined) await upsertSetting('WEBDAV_DIR', dir);
    if (retentionDays !== undefined)
      await upsertSetting('WEBDAV_RETENTION_DAYS', String(retentionDays));

    res.json({ message: '配置保存成功' });
  } catch (error) {
    next(error);
  }
};

/**
 * Test WebDAV connection
 */
export const testBackupConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.userId as string;
  const { url, username, password, dir } = req.body;

  try {
    let decryptedPassword = password;
    if (password === undefined || password === '') {
      const saved = await prisma.userSetting.findUnique({
        where: { userId_key: { userId, key: 'WEBDAV_PASSWORD' } },
      });
      if (saved) {
        decryptedPassword = decryptSecret(saved.value) || '';
      }
    }

    if (!url || !username || !decryptedPassword) {
      return res.status(400).json({ error: '服务地址、账号和密码不能为空' });
    }

    const client = new WebDAVClient(url, username, decryptedPassword, dir || '');
    await client.checkConnection();

    res.json({ success: true, message: 'WebDAV 服务连接成功！' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'WebDAV 连接测试失败' });
  }
};

/**
 * Remote cleanup helper
 */
const cleanupOldBackups = async (client: WebDAVClient, retentionDays: number) => {
  if (retentionDays <= 0) return;
  try {
    const files = await client.listFiles();
    const now = new Date();
    const cutoffTime = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (file.name.startsWith('cockpit_manual_backup_') && file.name.endsWith('.zip')) {
        if (file.lastModified.getTime() < cutoffTime) {
          logger.info(`[Backup Cleanup] Deleting old remote backup: ${file.name}`);
          await client.deleteFile(file.name).catch((err) => {
            logger.error(`[Backup Cleanup] Failed to delete ${file.name}:`, err.message);
          });
        }
      }
    }
  } catch (err: any) {
    logger.warn('[Backup Cleanup] Error during remote file cleanup:', err.message);
  }
};

/**
 * Generate and upload backup to WebDAV
 */
export const runBackup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.userId as string;
  const { categories } = req.body; // e.g. ['notes', 'microsoftEmail']

  if (!categories || !Array.isArray(categories) || categories.length === 0) {
    return res.status(400).json({ error: '请选择要备份的分类' });
  }

  try {
    const config = await getWebDAVConfig(userId);
    if (!config.url || !config.username || !config.password) {
      return res.status(400).json({ error: '请先配置 WebDAV 服务设置' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isAdmin = user?.role === 'ADMIN';

    const data: Record<string, any> = {};

    // GATHER DATA
    if (categories.includes('notes')) {
      const notes = await prisma.note.findMany({
        where: { userId },
        include: {
          likes: true,
          comments: true,
          noteShare: true,
        },
      });
      data.notes = notes;
    }

    if (categories.includes('microsoftEmail')) {
      const accounts = await prisma.microsoftEmailAccount.findMany({
        where: { userId },
      });
      data.microsoftEmail = accounts.map((acc) => ({
        ...acc,
        password: acc.password ? decryptSecret(acc.password) : null,
        refreshToken: acc.refreshToken ? decryptSecret(acc.refreshToken) : '',
        accessToken: acc.accessToken ? decryptSecret(acc.accessToken) : null,
        proxy: acc.proxy ? decryptSecret(acc.proxy) : null,
      }));
    }

    if (categories.includes('googleWarming')) {
      const accounts = await prisma.googleWarmingAccount.findMany({
        where: { userId },
      });
      data.googleWarming = accounts.map((acc) => ({
        ...acc,
        password: acc.password ? decryptSecret(acc.password) : '',
        twoFASecret: acc.twoFASecret ? decryptSecret(acc.twoFASecret) : null,
        backupCodes: acc.backupCodes ? decryptSecret(acc.backupCodes) : null,
      }));
    }

    if (categories.includes('twoFactor')) {
      const accounts = await prisma.twoFactorAccount.findMany({
        where: { userId },
      });
      data.twoFactor = {
        accounts: accounts.map((acc) => ({
          ...acc,
          secret: decryptSecret(acc.secret) || '',
        })),
        user2fa: {
          twoFactorEnabled: user?.twoFactorEnabled || false,
          twoFactorSecret: user?.twoFactorSecret ? decryptSecret(user.twoFactorSecret) : null,
          twoFactorRecoveryCodes: user?.twoFactorRecoveryCodes
            ? decryptSecret(user.twoFactorRecoveryCodes)
            : null,
        },
      };
    }

    if (isAdmin) {
      if (categories.includes('storageConfig')) {
        const configs = await prisma.storageConfig.findMany();
        data.storageConfig = configs.map((cfg) => ({
          ...cfg,
          secretAccessKey: decryptSecretIfNeeded(cfg.secretAccessKey),
          cloudflareApiToken: decryptSecretIfNeeded(cfg.cloudflareApiToken),
        }));
      }

      if (categories.includes('emailService')) {
        const emailSettings = await prisma.systemSetting.findMany({
          where: {
            key: {
              in: [
                'SMTP_HOST',
                'SMTP_PORT',
                'SMTP_USER',
                'SMTP_PASS',
                'SMTP_FROM',
                'SMTP_SECURE',
                'SYSTEM_EMAIL_PROVIDER',
                'MICROSOFT_POOL_FAILBACK',
                'EMAIL_VERIFY_SUBJECT',
                'EMAIL_VERIFY_BODY',
                'SMTP_CONFIGS',
                'SMTP_ACTIVE_CONFIG_ID',
              ],
            },
          },
        });
        data.emailService = emailSettings.map((s) => {
          if (s.key === 'SMTP_PASS' && s.value) {
            return { ...s, value: decryptSecret(s.value) || '' };
          }
          return s;
        });
      }

      if (categories.includes('aiAssistant')) {
        const aiSettings = await prisma.systemSetting.findMany({
          where: { key: { startsWith: 'AI_' } },
        });
        const integrations = await prisma.aiBotIntegration.findMany({
          include: { knowledgeSources: true },
        });
        data.aiAssistant = {
          aiSettings: aiSettings.map((s) => {
            if (s.key === 'AI_API_KEY' && s.value) {
              return { ...s, value: decryptSecret(s.value) || '' };
            }
            return s;
          }),
          integrations: integrations.map((item) => ({
            ...item,
            webhookUrl: item.webhookUrl ? decryptSecret(item.webhookUrl) : null,
            secret: item.secret ? decryptSecret(item.secret) : null,
          })),
        };
      }

      if (categories.includes('controlCenter')) {
        const emailServiceKeys = [
          'SMTP_HOST',
          'SMTP_PORT',
          'SMTP_USER',
          'SMTP_PASS',
          'SMTP_FROM',
          'SMTP_SECURE',
          'SYSTEM_EMAIL_PROVIDER',
          'MICROSOFT_POOL_FAILBACK',
          'EMAIL_VERIFY_SUBJECT',
          'EMAIL_VERIFY_BODY',
          'SMTP_CONFIGS',
          'SMTP_ACTIVE_CONFIG_ID',
        ];
        const systemSettings = await prisma.systemSetting.findMany({
          where: {
            NOT: [{ key: { in: emailServiceKeys } }, { key: { startsWith: 'AI_' } }],
          },
        });
        data.controlCenter = systemSettings;
      }
    }

    // ZIP CREATION
    const tempDir = path.join(process.cwd(), 'uploads', 'temp_backups');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/T/, '_')
      .replace(/\..+/, '')
      .replace(/:/g, '-');
    const isFull =
      categories.includes('notes') &&
      categories.includes('microsoftEmail') &&
      categories.includes('googleWarming') &&
      categories.includes('twoFactor');
    const filename = `cockpit_manual_backup_${isFull ? 'full' : 'custom'}_${timestamp}.zip`;
    const filePath = path.join(tempDir, filename);

    const output = fs.createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);

    // metadata.json
    const metadata = {
      userId,
      username: user?.name || user?.email || 'Unknown',
      timestamp: new Date().toISOString(),
      categories,
      type: isAdmin ? 'admin' : 'user',
    };
    archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

    // Categories
    for (const cat of categories) {
      if (data[cat] !== undefined) {
        archive.append(JSON.stringify(data[cat], null, 2), { name: `${cat}.json` });
      }
    }

    await new Promise<void>((resolve, reject) => {
      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));
      archive.finalize();
    });

    // UPLOAD TO WEBDAV
    const webdavClient = new WebDAVClient(config.url, config.username, config.password, config.dir);
    const fileBuffer = fs.readFileSync(filePath);
    await webdavClient.uploadFile(filename, fileBuffer);

    // CLEANUP LOCAL FILE
    fs.unlinkSync(filePath);

    // AUTO CLEANUP REMOTE OLD BACKUPS
    await cleanupOldBackups(webdavClient, config.retentionDays);

    // Record last sync time in user settings
    await prisma.userSetting.upsert({
      where: { userId_key: { userId, key: 'WEBDAV_LAST_BACKUP' } },
      update: { value: `${new Date().toISOString()}|${filename}` },
      create: {
        userId,
        key: 'WEBDAV_LAST_BACKUP',
        value: `${new Date().toISOString()}|${filename}`,
      },
    });

    res.json({ success: true, filename, message: '备份成功并已上传至云端！' });
  } catch (error: any) {
    logger.error('[Backup] Backup failed:', error.message);
    res.status(500).json({ error: error.message || '备份失败，请检查 WebDAV 配置或网络状况' });
  }
};

/**
 * List backups on WebDAV
 */
export const listBackups = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.userId as string;
  try {
    const config = await getWebDAVConfig(userId);
    if (!config.url || !config.username || !config.password) {
      return res.json([]);
    }

    const webdavClient = new WebDAVClient(config.url, config.username, config.password, config.dir);
    const files = await webdavClient.listFiles();

    // Filter only files matching cockpit_manual_backup_*.zip
    const filteredFiles = files
      .filter(
        (file) => file.name.startsWith('cockpit_manual_backup_') && file.name.endsWith('.zip'),
      )
      .map((file) => ({
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
      }));

    // Sort by lastModified descending
    filteredFiles.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

    // Get last backup/restore status
    const lastBackupSetting = await prisma.userSetting.findUnique({
      where: { userId_key: { userId, key: 'WEBDAV_LAST_BACKUP' } },
    });
    const lastRestoreSetting = await prisma.userSetting.findUnique({
      where: { userId_key: { userId, key: 'WEBDAV_LAST_RESTORE' } },
    });

    res.json({
      backups: filteredFiles,
      lastBackup: lastBackupSetting?.value || null,
      lastRestore: lastRestoreSetting?.value || null,
    });
  } catch (error: any) {
    logger.error('[Backup] List backups failed:', error.message);
    res.status(500).json({ error: error.message || '获取备份列表失败' });
  }
};

/**
 * Delete a remote backup
 */
export const deleteBackup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.userId as string;
  const filename = req.params.filename;

  if (typeof filename !== 'string') {
    return res.status(400).json({ error: '文件名错误' });
  }

  try {
    const config = await getWebDAVConfig(userId);
    if (!config.url || !config.username || !config.password) {
      return res.status(400).json({ error: '请先配置 WebDAV 服务设置' });
    }

    const webdavClient = new WebDAVClient(config.url, config.username, config.password, config.dir);
    await webdavClient.deleteFile(filename);

    res.json({ success: true, message: '备份已成功从云端删除' });
  } catch (error: any) {
    logger.error('[Backup] Delete failed:', error.message);
    res.status(500).json({ error: error.message || '删除备份失败' });
  }
};

/**
 * Restore from a remote backup
 */
export const restoreBackup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.userId as string;
  const { filename, restoreCategories } = req.body; // restoreCategories: array of keys to restore

  if (!filename) {
    return res.status(400).json({ error: '文件名不能为空' });
  }
  if (!restoreCategories || !Array.isArray(restoreCategories) || restoreCategories.length === 0) {
    return res.status(400).json({ error: '请选择要恢复的分类' });
  }

  try {
    const config = await getWebDAVConfig(userId);
    if (!config.url || !config.username || !config.password) {
      return res.status(400).json({ error: '请先配置 WebDAV 服务设置' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isAdmin = user?.role === 'ADMIN';

    // DOWNLOAD ZIP FROM WEBDAV
    const webdavClient = new WebDAVClient(config.url, config.username, config.password, config.dir);
    const fileBuffer = await webdavClient.downloadFile(filename);

    // WRITE TEMP ZIP
    const tempDir = path.join(process.cwd(), 'uploads', 'temp_backups');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFilePath = path.join(tempDir, `restore_${Date.now()}_${filename}`);
    fs.writeFileSync(tempFilePath, fileBuffer);

    // OPEN ZIP AND PARSE CONTENTS
    const extractedData: Record<string, any> = {};
    const directory = await unzipper.Open.file(tempFilePath);
    for (const file of directory.files) {
      const content = await file.buffer();
      const catName = path.basename(file.path, '.json');
      try {
        extractedData[catName] = JSON.parse(content.toString('utf8'));
      } catch (err) {
        logger.warn(`[Restore] Failed to parse JSON file in zip: ${file.path}`);
      }
    }

    // CLEANUP LOCAL TEMP ZIP
    fs.unlinkSync(tempFilePath);

    // RESTORE LOGIC PER CATEGORY
    if (restoreCategories.includes('notes') && extractedData['notes']) {
      const notes = extractedData['notes'];
      for (const note of notes) {
        await prisma.note.upsert({
          where: { id: note.id },
          update: {
            title: note.title,
            content: note.content,
            summary: note.summary,
            visibility: note.visibility,
            tags: note.tags,
            category: note.category,
            views: note.views,
            isPinned: note.isPinned,
            isPopular: note.isPopular,
            updatedAt: new Date(note.updatedAt),
          },
          create: {
            id: note.id,
            title: note.title,
            content: note.content,
            summary: note.summary,
            visibility: note.visibility,
            tags: note.tags,
            category: note.category,
            views: note.views,
            isPinned: note.isPinned,
            isPopular: note.isPopular,
            userId: userId,
            createdAt: new Date(note.createdAt),
            updatedAt: new Date(note.updatedAt),
          },
        });

        // Recreate note likes, comments, shares
        await prisma.noteLike.deleteMany({ where: { noteId: note.id } });
        for (const like of note.likes || []) {
          await prisma.noteLike.create({
            data: {
              noteId: note.id,
              userId: like.userId,
              createdAt: new Date(like.createdAt),
            },
          });
        }

        await prisma.noteComment.deleteMany({ where: { noteId: note.id } });
        for (const comment of note.comments || []) {
          await prisma.noteComment.create({
            data: {
              id: comment.id,
              content: comment.content,
              noteId: note.id,
              userId: comment.userId,
              createdAt: new Date(comment.createdAt),
              updatedAt: new Date(comment.updatedAt),
            },
          });
        }

        await prisma.noteShare.deleteMany({ where: { noteId: note.id } });
        if (note.noteShare) {
          await prisma.noteShare.create({
            data: {
              id: note.noteShare.id,
              noteId: note.id,
              userId: note.noteShare.userId,
              expiresAt: note.noteShare.expiresAt ? new Date(note.noteShare.expiresAt) : null,
              customText: note.noteShare.customText,
              createdAt: new Date(note.noteShare.createdAt),
              updatedAt: new Date(note.noteShare.updatedAt),
            },
          });
        }
      }
    }

    if (restoreCategories.includes('microsoftEmail') && extractedData['microsoftEmail']) {
      const accounts = extractedData['microsoftEmail'];
      for (const acc of accounts) {
        await prisma.microsoftEmailAccount.upsert({
          where: { email: acc.email },
          update: {
            userId: userId,
            password: acc.password ? encryptSecret(acc.password) : null,
            clientId: acc.clientId,
            refreshToken: encryptSecret(acc.refreshToken) || acc.refreshToken,
            accessToken: acc.accessToken ? encryptSecret(acc.accessToken) : null,
            tokenExpiresAt: acc.tokenExpiresAt ? new Date(acc.tokenExpiresAt) : null,
            status: acc.status,
            statusMessage: acc.statusMessage,
            proxy: acc.proxy ? encryptSecret(acc.proxy) : null,
            userAgent: acc.userAgent,
            dailyLimit: acc.dailyLimit,
            sentCountToday: acc.sentCountToday,
            lastResetDate: new Date(acc.lastResetDate),
            minDelay: acc.minDelay,
            maxDelay: acc.maxDelay,
            updatedAt: new Date(),
          },
          create: {
            id: acc.id,
            userId: userId,
            email: acc.email,
            password: acc.password ? encryptSecret(acc.password) : null,
            clientId: acc.clientId,
            refreshToken: encryptSecret(acc.refreshToken) || acc.refreshToken,
            accessToken: acc.accessToken ? encryptSecret(acc.accessToken) : null,
            tokenExpiresAt: acc.tokenExpiresAt ? new Date(acc.tokenExpiresAt) : null,
            status: acc.status,
            statusMessage: acc.statusMessage,
            proxy: acc.proxy ? encryptSecret(acc.proxy) : null,
            userAgent: acc.userAgent,
            dailyLimit: acc.dailyLimit,
            sentCountToday: acc.sentCountToday,
            lastResetDate: new Date(acc.lastResetDate),
            minDelay: acc.minDelay,
            maxDelay: acc.maxDelay,
            createdAt: new Date(acc.createdAt),
            updatedAt: new Date(acc.updatedAt),
          },
        });
      }
    }

    if (restoreCategories.includes('googleWarming') && extractedData['googleWarming']) {
      const accounts = extractedData['googleWarming'];
      for (const acc of accounts) {
        await prisma.googleWarmingAccount.upsert({
          where: { id: acc.id },
          update: {
            userId: userId,
            email: acc.email,
            password: encryptSecret(acc.password) || '',
            recoveryEmail: acc.recoveryEmail,
            twoFASecret: acc.twoFASecret ? encryptSecret(acc.twoFASecret) : null,
            country: acc.country,
            note: acc.note,
            backupCodes: acc.backupCodes ? encryptSecret(acc.backupCodes) : null,
            category: acc.category,
            status: acc.status,
            currentDay: acc.currentDay,
            lastWarmedAt: acc.lastWarmedAt ? new Date(acc.lastWarmedAt) : null,
            updatedAt: new Date(),
          },
          create: {
            id: acc.id,
            userId: userId,
            email: acc.email,
            password: encryptSecret(acc.password) || '',
            recoveryEmail: acc.recoveryEmail,
            twoFASecret: acc.twoFASecret ? encryptSecret(acc.twoFASecret) : null,
            country: acc.country,
            note: acc.note,
            backupCodes: acc.backupCodes ? encryptSecret(acc.backupCodes) : null,
            category: acc.category,
            status: acc.status,
            currentDay: acc.currentDay,
            lastWarmedAt: acc.lastWarmedAt ? new Date(acc.lastWarmedAt) : null,
            createdAt: new Date(acc.createdAt),
            updatedAt: new Date(acc.updatedAt),
          },
        });
      }
    }

    if (restoreCategories.includes('twoFactor') && extractedData['twoFactor']) {
      const twoFactor = extractedData['twoFactor'];
      for (const acc of twoFactor.accounts || []) {
        await prisma.twoFactorAccount.upsert({
          where: { id: acc.id },
          update: {
            userId: userId,
            label: acc.label,
            email: acc.email,
            secret: encryptSecret(acc.secret) || '',
            note: acc.note,
            category: acc.category,
            updatedAt: new Date(),
          },
          create: {
            id: acc.id,
            userId: userId,
            label: acc.label,
            email: acc.email,
            secret: encryptSecret(acc.secret) || '',
            note: acc.note,
            category: acc.category,
            createdAt: new Date(acc.createdAt),
            updatedAt: new Date(acc.updatedAt),
          },
        });
      }

      if (twoFactor.user2fa) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            twoFactorEnabled: twoFactor.user2fa.twoFactorEnabled,
            twoFactorSecret: twoFactor.user2fa.twoFactorSecret
              ? encryptSecret(twoFactor.user2fa.twoFactorSecret)
              : null,
            twoFactorRecoveryCodes: twoFactor.user2fa.twoFactorRecoveryCodes
              ? encryptSecret(twoFactor.user2fa.twoFactorRecoveryCodes)
              : null,
          },
        });
      }
    }

    if (isAdmin) {
      if (restoreCategories.includes('storageConfig') && extractedData['storageConfig']) {
        const configs = extractedData['storageConfig'];
        for (const config of configs) {
          await prisma.storageConfig.upsert({
            where: { id: config.id },
            update: {
              name: config.name,
              provider: config.provider,
              endpoint: config.endpoint,
              accessKeyId: config.accessKeyId,
              secretAccessKey: encrypt(config.secretAccessKey),
              bucketName: config.bucketName,
              publicUrl: config.publicUrl,
              cloudflareAccountId: config.cloudflareAccountId,
              cloudflareApiToken: config.cloudflareApiToken
                ? encrypt(config.cloudflareApiToken)
                : null,
              remark: config.remark,
              limitGb: config.limitGb,
              usedBytes: config.usedBytes,
              assetType: config.assetType,
              priority: config.priority,
              status: config.status,
              updatedAt: new Date(),
            },
            create: {
              id: config.id,
              name: config.name,
              provider: config.provider,
              endpoint: config.endpoint,
              accessKeyId: config.accessKeyId,
              secretAccessKey: encrypt(config.secretAccessKey),
              bucketName: config.bucketName,
              publicUrl: config.publicUrl,
              cloudflareAccountId: config.cloudflareAccountId,
              cloudflareApiToken: config.cloudflareApiToken
                ? encrypt(config.cloudflareApiToken)
                : null,
              remark: config.remark,
              limitGb: config.limitGb,
              usedBytes: config.usedBytes,
              assetType: config.assetType,
              priority: config.priority,
              status: config.status,
              createdAt: new Date(config.createdAt),
              updatedAt: new Date(config.updatedAt),
            },
          });
        }
      }

      if (restoreCategories.includes('emailService') && extractedData['emailService']) {
        const emailSettings = extractedData['emailService'];
        for (const setting of emailSettings) {
          let val = setting.value;
          if (setting.key === 'SMTP_PASS' && val) {
            val = encryptSecret(val) || '';
          }
          await prisma.systemSetting.upsert({
            where: { key: setting.key },
            update: { value: val },
            create: { key: setting.key, value: val },
          });
        }
      }

      if (restoreCategories.includes('aiAssistant') && extractedData['aiAssistant']) {
        const aiData = extractedData['aiAssistant'];
        for (const setting of aiData.aiSettings || []) {
          let val = setting.value;
          if (setting.key === 'AI_API_KEY' && val) {
            val = encryptSecret(val) || '';
          }
          await prisma.systemSetting.upsert({
            where: { key: setting.key },
            update: { value: val },
            create: { key: setting.key, value: val },
          });
        }

        for (const item of aiData.integrations || []) {
          await prisma.aiBotIntegration.upsert({
            where: { id: item.id },
            update: {
              userId: item.userId,
              name: item.name,
              platform: item.platform,
              status: item.status,
              webhookUrl: item.webhookUrl ? encryptSecret(item.webhookUrl) : null,
              secret: item.secret ? encryptSecret(item.secret) : null,
              publicToken: item.publicToken,
              triggerKeywords: item.triggerKeywords,
              systemPrompt: item.systemPrompt,
              responseMode: item.responseMode,
              aiModelId: item.aiModelId,
              aiTemperature: item.aiTemperature,
              aiMaxTokens: item.aiMaxTokens,
              lastUsedAt: item.lastUsedAt ? new Date(item.lastUsedAt) : null,
              updatedAt: new Date(),
            },
            create: {
              id: item.id,
              userId: item.userId,
              name: item.name,
              platform: item.platform,
              status: item.status,
              webhookUrl: item.webhookUrl ? encryptSecret(item.webhookUrl) : null,
              secret: item.secret ? encryptSecret(item.secret) : null,
              publicToken: item.publicToken,
              triggerKeywords: item.triggerKeywords,
              systemPrompt: item.systemPrompt,
              responseMode: item.responseMode,
              aiModelId: item.aiModelId,
              aiTemperature: item.aiTemperature,
              aiMaxTokens: item.aiMaxTokens,
              lastUsedAt: item.lastUsedAt ? new Date(item.lastUsedAt) : null,
              createdAt: new Date(item.createdAt),
              updatedAt: new Date(item.updatedAt),
            },
          });

          for (const source of item.knowledgeSources || []) {
            await prisma.aiBotKnowledgeSource.upsert({
              where: { id: source.id },
              update: {
                userId: source.userId,
                integrationId: source.integrationId,
                title: source.title,
                sourceType: source.sourceType,
                status: source.status,
                visibility: source.visibility,
                content: source.content,
                url: source.url,
                tags: source.tags,
                priority: source.priority,
                tokenEstimate: source.tokenEstimate,
                lastIndexedAt: source.lastIndexedAt ? new Date(source.lastIndexedAt) : null,
                updatedAt: new Date(),
              },
              create: {
                id: source.id,
                userId: source.userId,
                integrationId: source.integrationId,
                title: source.title,
                sourceType: source.sourceType,
                status: source.status,
                visibility: source.visibility,
                content: source.content,
                url: source.url,
                tags: source.tags,
                priority: source.priority,
                tokenEstimate: source.tokenEstimate,
                lastIndexedAt: source.lastIndexedAt ? new Date(source.lastIndexedAt) : null,
                createdAt: new Date(source.createdAt),
                updatedAt: new Date(source.updatedAt),
              },
            });
          }
        }
      }

      if (restoreCategories.includes('controlCenter') && extractedData['controlCenter']) {
        const systemSettings = extractedData['controlCenter'];
        for (const setting of systemSettings) {
          await prisma.systemSetting.upsert({
            where: { key: setting.key },
            update: { value: setting.value },
            create: { key: setting.key, value: setting.value },
          });
        }
      }
    }

    // Record last restore time in user settings
    await prisma.userSetting.upsert({
      where: { userId_key: { userId, key: 'WEBDAV_LAST_RESTORE' } },
      update: { value: `${new Date().toISOString()}|${filename}` },
      create: {
        userId,
        key: 'WEBDAV_LAST_RESTORE',
        value: `${new Date().toISOString()}|${filename}`,
      },
    });

    res.json({ success: true, message: '备份数据恢复成功！相关功能配置已更新。' });
  } catch (error: any) {
    logger.error('[Backup] Restore failed:', error.message);
    res
      .status(500)
      .json({ error: error.message || '恢复备份失败，请检查云端连接或备份文件完整性' });
  }
};

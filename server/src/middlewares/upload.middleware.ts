import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { settingsService } from '../services/settings.service';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dir = './uploads/avatars';

    if (file.fieldname === 'cover') {
      dir = './uploads/covers';
    } else if (
      file.fieldname === 'attachment' ||
      file.fieldname === 'file' ||
      file.fieldname === 'files'
    ) {
      dir = './uploads/feedback';
    } else if (file.fieldname === 'message_file') {
      dir = './uploads/messages';
    } else if (file.fieldname === 'asset') {
      dir = './uploads/assets';
    } else if (file.fieldname === 'material' || file.fieldname === 'preview') {
      dir = './uploads/materials';
    } else if (
      (file.fieldname === 'thumbnail' || file.fieldname === 'images') &&
      req.baseUrl.includes('showcase')
    ) {
      dir = './uploads/showcase';
    } else if (file.fieldname === 'thumbnail') {
      dir = './uploads/assets';
    } else if (file.fieldname === 'logo' || file.fieldname === 'favicon') {
      dir = './uploads/branding';
    } else if (file.fieldname === 'images') {
      dir = './uploads/discussions';
    } else if (file.fieldname === 'manual_image') {
      dir = './uploads/manual';
    } else if (file.fieldname === 'mirror_image') {
      dir = './uploads/mirror';
    }

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(sanitizedOriginalName));
  },
});

const createUploadMiddleware = (config: {
  type: 'single' | 'array' | 'fields';
  fieldname?: string;
  maxCount?: number;
  fields?: multer.Field[];
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await settingsService.getAll();
      let maxFileSize = (settings.MAX_FILE_SIZE || 100) * 1024 * 1024;
      let allowedExtensions: string[] = ['.jpeg', '.jpg', '.png', '.glb', '.gltf'];

      // 处理允许的扩展名 - 支持字符串和数组格式
      if (settings.ALLOWED_EXTENSIONS) {
        if (typeof settings.ALLOWED_EXTENSIONS === 'string') {
          allowedExtensions = (settings.ALLOWED_EXTENSIONS as string)
            .split(',')
            .map((ext) => ext.trim().toLowerCase());
        } else if (Array.isArray(settings.ALLOWED_EXTENSIONS)) {
          allowedExtensions = (settings.ALLOWED_EXTENSIONS as any[]).map((ext) =>
            ext.toLowerCase(),
          );
        }
      }

      // Check if it's logo, favicon, or avatar to set lower default limit (5MB) before upload
      const isSystemImage =
        config.fieldname === 'logo' ||
        config.fieldname === 'favicon' ||
        config.fieldname === 'avatar' ||
        config.fieldname === 'cover' ||
        config.fieldname === 'manual_image' ||
        config.fieldname === 'mirror_image' ||
        (config.fields &&
          config.fields.some((f) =>
            ['logo', 'favicon', 'avatar', 'cover', 'manual_image', 'mirror_image'].includes(f.name),
          ));

      if (isSystemImage) {
        maxFileSize = 5 * 1024 * 1024;
      }

      const dynamicMulter = multer({
        storage: storage,
        limits: {
          fileSize: maxFileSize,
          files: 100,
        },
      });

      let multerAction;
      if (config.type === 'single') {
        multerAction = dynamicMulter.single(config.fieldname!);
      } else if (config.type === 'array') {
        multerAction = dynamicMulter.array(config.fieldname!, config.maxCount);
      } else {
        multerAction = dynamicMulter.fields(config.fields!);
      }

      multerAction(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            const displayLimit = isSystemImage ? '5' : settings.MAX_FILE_SIZE || '100';
            console.error(`[UploadError] LIMIT_FILE_SIZE: file size exceeded (${displayLimit}MB)`);
            return res.status(400).json({ error: `文件大小超过限制 (${displayLimit}MB)` });
          }
          console.error(`[UploadError] MulterError: ${err instanceof Error ? err.message : err}`);
          return res.status(400).json({ error: err instanceof Error ? err.message : 'An error occurred' });
        } else if (err) {
          console.error(`[UploadError] Unknown error: ${err instanceof Error ? err.message : err}`);
          return res.status(400).json({ error: err instanceof Error ? err.message : 'An error occurred' });
        }

        // Manual extension check for dynamic settings
        const files = req.file
          ? { [req.file.fieldname]: [req.file] }
          : (req.files as { [fieldname: string]: Express.Multer.File[] });

        if (files) {
          for (const fieldname in files) {
            const fileList = Array.isArray(files[fieldname])
              ? files[fieldname]
              : [files[fieldname]];
            for (const file of fileList) {
              if (!file) continue;
              const ext = path.extname(file.originalname).toLowerCase();

              // 针对系统 Logo、Favicon 和用户头像等特定用途的图片，使用专属安全后缀白名单而非全局用户上传类型限制
              let finalAllowedExtensions = allowedExtensions;
              let finalMaxFileSize = maxFileSize;

              if (
                file.fieldname === 'logo' ||
                file.fieldname === 'favicon' ||
                file.fieldname === 'avatar' ||
                file.fieldname === 'cover' ||
                file.fieldname === 'manual_image' ||
                file.fieldname === 'mirror_image'
              ) {
                finalAllowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'];
              } else if (
                file.fieldname === 'file' ||
                file.fieldname === 'excel' ||
                file.fieldname === 'files'
              ) {
                finalAllowedExtensions = [...allowedExtensions, '.xlsx', '.xls'];
              } else if (file.fieldname === 'message_file') {
                finalAllowedExtensions = [
                  '.png',
                  '.jpg',
                  '.jpeg',
                  '.gif',
                  '.webp',
                  '.svg',
                  '.webm',
                  '.wav',
                  '.mp3',
                  '.ogg',
                  '.m4a',
                  '.mp4',
                  '.aac',
                  '.pdf',
                  '.doc',
                  '.docx',
                  '.xls',
                  '.xlsx',
                  '.ppt',
                  '.pptx',
                  '.txt',
                  '.zip',
                  '.rar',
                  '.7z',
                  '.glb',
                  '.gltf',
                  '.fbx',
                  '.obj',
                  '.stl',
                ];
              }

              if (!finalAllowedExtensions.includes(ext)) {
                console.error(
                  `[UploadError] Extension not allowed: ${ext} for field ${file.fieldname}. Allowed: ${finalAllowedExtensions.join(', ')}`,
                );
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                return res.status(400).json({ error: `不支持的文件类型: ${ext}` });
              }
              if (file.size > finalMaxFileSize) {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                const displayLimit =
                  file.fieldname === 'logo' ||
                  file.fieldname === 'favicon' ||
                  file.fieldname === 'avatar' ||
                  file.fieldname === 'cover'
                    ? '5'
                    : settings.MAX_FILE_SIZE;
                console.error(
                  `[UploadError] File ${file.originalname} size ${file.size} exceeded limit ${displayLimit}MB`,
                );
                return res.status(400).json({
                  error: `文件 ${file.originalname} 超过大小限制 (${displayLimit}MB)`,
                });
              }
            }
          }
        }
        next();
      });
    } catch (error) {
      next(error);
    }
  };
};

export const upload = {
  single: (fieldname: string) => createUploadMiddleware({ type: 'single', fieldname }),
  array: (fieldname: string, maxCount?: number) =>
    createUploadMiddleware({ type: 'array', fieldname, maxCount }),
  fields: (fields: multer.Field[]) => createUploadMiddleware({ type: 'fields', fields }),
};

const model3dExtensions = [
  '.glb',
  '.gltf',
  '.fbx',
  '.obj',
  '.stl',
  '.dae',
  '.3ds',
  '.blend',
  '.usdz',
  '.abc',
];
const documentExtensions = ['.pdf', '.zip', '.rar', '.7z'];
const imageUploadFields = new Set([
  'avatar',
  'cover',
  'thumbnail',
  'images',
  'manual_image',
  'mirror_image',
]);

const detectImageMime = (buffer: Buffer): string | null => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
    buffer.subarray(0, 6).toString('ascii') === 'GIF89a'
  ) {
    return 'image/gif';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.subarray(0, 2).toString('ascii') === 'BM') {
    return 'image/bmp';
  }
  return null;
};

const looksLikeExecutableContent = (buffer: Buffer): boolean => {
  const text = buffer.subarray(0, 4096).toString('utf8').toLowerCase();
  return (
    text.includes('<script') ||
    text.includes('<!doctype html') ||
    text.includes('<html') ||
    text.includes('<?php') ||
    text.startsWith('#!/bin/sh') ||
    text.startsWith('#!/usr/bin/env') ||
    text.startsWith('@echo off')
  );
};

export const validateFileContent = async (req: Request, res: Response, next: NextFunction) => {
  const files = req.file
    ? [req.file]
    : req.files
      ? (Object.values(req.files).flat() as Express.Multer.File[])
      : [];
  if (files.length === 0) return next();

  try {
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();

      if (model3dExtensions.includes(ext) || documentExtensions.includes(ext)) {
        continue;
      }

      if (ext === '.svg') {
        try {
          const content = await fs.promises.readFile(file.path, 'utf8');
          const hasScript = /<script\b[^>]*>/i.test(content);
          const hasEventHandlers = /\bon[a-z]+\s*=/i.test(content);
          const hasJavascriptUrl = /href\s*=\s*["']\s*javascript:/i.test(content);
          if (hasScript || hasEventHandlers || hasJavascriptUrl) {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            return res.status(400).json({ error: '安全验证失败：SVG文件包含潜在的安全隐患' });
          }

          if (!content.includes('<svg') && !content.includes('http://www.w3.org/2000/svg')) {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            return res.status(400).json({ error: '无效的SVG图片内容' });
          }
          continue;
        } catch (readErr) {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          return res.status(400).json({ error: '文件读取失败' });
        }
      }

      const buffer = await fs.promises.readFile(file.path);
      if (buffer.length > 0) {
        const imageMime = detectImageMime(buffer);

        if (imageUploadFields.has(file.fieldname)) {
          if (!imageMime) {
            fs.unlinkSync(file.path);
            return res.status(400).json({ error: '无效的图片文件内容' });
          }
        }

        if (looksLikeExecutableContent(buffer)) {
          fs.unlinkSync(file.path);
          return res.status(400).json({ error: '不允许上传可执行或脚本文件' });
        }
      }
    }

    next();
  } catch (error) {
    console.error('File validation error:', error);
    for (const file of files) {
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
    return res.status(500).json({ error: '文件验证失败' });
  }
};

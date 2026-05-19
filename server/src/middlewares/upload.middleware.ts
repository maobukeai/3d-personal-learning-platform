import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { settingsService } from '../services/settings.service';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dir = './uploads/avatars';

    if (file.fieldname === 'attachment' || file.fieldname === 'file') {
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
        (config.fields && config.fields.some((f) => ['logo', 'favicon', 'avatar'].includes(f.name)));

      if (isSystemImage) {
        maxFileSize = 5 * 1024 * 1024;
      }

      const dynamicMulter = multer({
        storage: storage,
        limits: {
          fileSize: maxFileSize,
          files: 10,
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
            return res.status(400).json({ error: `文件大小超过限制 (${displayLimit}MB)` });
          }
          return res.status(400).json({ error: err.message });
        } else if (err) {
          return res.status(400).json({ error: err.message });
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

              // 针对系统 Logo、Favicon 和用户头像等特定用途 of 图片，使用专属安全后缀白名单而非全局用户上传类型限制
              let finalAllowedExtensions = allowedExtensions;

              if (
                file.fieldname === 'logo' ||
                file.fieldname === 'favicon' ||
                file.fieldname === 'avatar'
              ) {
                finalAllowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'];
              }

              if (!finalAllowedExtensions.includes(ext)) {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                return res.status(400).json({ error: `不支持的文件类型: ${ext}` });
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

export const validateFileContent = async (req: Request, res: Response, next: NextFunction) => {
  const files = req.file
    ? [req.file]
    : req.files
      ? (Object.values(req.files).flat() as Express.Multer.File[])
      : [];
  if (files.length === 0) return next();

  try {
    const FileType = await import('file-type');

    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();

      if (model3dExtensions.includes(ext) || documentExtensions.includes(ext)) {
        continue;
      }

      const buffer = fs.readFileSync(file.path);
      if (buffer.length > 0) {
        const result = await FileType.fromBuffer(buffer);

        if (
          file.fieldname === 'avatar' ||
          file.fieldname === 'thumbnail' ||
          file.fieldname === 'images'
        ) {
          if (
            !result ||
            ![
              'image/jpeg',
              'image/png',
              'image/gif',
              'image/webp',
              'image/svg+xml',
              'image/bmp',
            ].includes(result.mime)
          ) {
            fs.unlinkSync(file.path);
            return res.status(400).json({ error: '无效的图片文件内容' });
          }
        }

        if (
          result &&
          (result.mime.includes('javascript') ||
            result.mime.includes('php') ||
            result.mime.includes('html') ||
            result.mime.includes('x-shellscript'))
        ) {
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

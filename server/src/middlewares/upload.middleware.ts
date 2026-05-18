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

const multerInstance = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // High upper limit for multer, we validate lower in wrapper
    files: 10,
  },
});

const createUploadMiddleware = (multerAction: any) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await settingsService.getAll();
      const maxFileSize = (settings.MAX_FILE_SIZE || 100) * 1024 * 1024;
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

      multerAction(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
          return res.status(400).json({ error: err.message });
        } else if (err) {
          return res.status(400).json({ error: err.message });
        }

        // Manual extension and size check for dynamic settings
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
              if (!allowedExtensions.includes(ext)) {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                return res.status(400).json({ error: `不支持的文件类型: ${ext}` });
              }
              if (file.size > maxFileSize) {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                return res.status(400).json({
                  error: `文件 ${file.originalname} 超过大小限制 (${settings.MAX_FILE_SIZE}MB)`,
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
  single: (fieldname: string) => createUploadMiddleware(multerInstance.single(fieldname)),
  array: (fieldname: string, maxCount?: number) =>
    createUploadMiddleware(multerInstance.array(fieldname, maxCount)),
  fields: (fields: multer.Field[]) => createUploadMiddleware(multerInstance.fields(fields)),
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

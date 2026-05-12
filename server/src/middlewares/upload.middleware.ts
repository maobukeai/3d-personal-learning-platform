import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dir = './uploads/avatars';
    
    if (file.fieldname === 'attachment') {
      dir = './uploads/feedback';
    } else if (file.fieldname === 'message_file') {
      dir = './uploads/messages';
    } else if (file.fieldname === 'asset') {
      dir = './uploads/assets';
    } else if (file.fieldname === 'material' || file.fieldname === 'preview') {
      dir = './uploads/materials';
    } else if ((file.fieldname === 'thumbnail' || file.fieldname === 'images') && req.baseUrl.includes('showcase')) {
       dir = './uploads/showcase';
    } else if (file.fieldname === 'thumbnail') {
       dir = './uploads/assets';
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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(sanitizedOriginalName));
  }
});

const imageExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.svg', '.bmp'];
const documentExtensions = ['.pdf', '.zip', '.rar', '.7z'];
const model3dExtensions = ['.glb', '.gltf', '.fbx', '.obj', '.stl', '.dae', '.3ds', '.blend', '.usdz', '.abc'];
const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
const audioExtensions = ['.mp3', '.wav', '.ogg', '.flac'];

const allowedExtensions = [
  ...imageExtensions,
  ...documentExtensions,
  ...model3dExtensions,
  ...videoExtensions,
  ...audioExtensions
];

const fieldSizeLimits: Record<string, number> = {
  avatar: 5 * 1024 * 1024,
  thumbnail: 10 * 1024 * 1024,
  attachment: 20 * 1024 * 1024,
  message_file: 20 * 1024 * 1024,
  images: 10 * 1024 * 1024,
  asset: 100 * 1024 * 1024,
  material: 100 * 1024 * 1024,
  preview: 50 * 1024 * 1024
};

export const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 100 * 1024 * 1024,
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error(`不支持的文件类型: ${ext}。支持的类型: ${allowedExtensions.join(', ')}`));
    }

    const fieldLimit = fieldSizeLimits[file.fieldname];
    if (fieldLimit) {
      req.headers['content-length'] = String(Math.min(Number(req.headers['content-length'] || 0), fieldLimit));
    }

    cb(null, true);
  }
});

export const validateFileContent = async (req: Request, res: Response, next: NextFunction) => {
  const files = req.file ? [req.file] : (req.files ? (Object.values(req.files).flat() as Express.Multer.File[]) : []);
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

        if (file.fieldname === 'avatar' || file.fieldname === 'thumbnail' || file.fieldname === 'images') {
          if (!result || !['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'].includes(result.mime)) {
            fs.unlinkSync(file.path);
            return res.status(400).json({ error: '无效的图片文件内容' });
          }
        }

        if (result && (result.mime.includes('javascript') || result.mime.includes('php') || result.mime.includes('html') || result.mime.includes('x-shellscript'))) {
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

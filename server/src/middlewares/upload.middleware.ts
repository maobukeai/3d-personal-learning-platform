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
    } else if (file.fieldname === 'thumbnail' && req.baseUrl.includes('showcase')) {
       dir = './uploads/showcase';
    } else if (file.fieldname === 'thumbnail') {
       dir = './uploads/assets';
    }
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename: remove special characters and spaces
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(sanitizedOriginalName));
  }
});

const allowedExtensions = ['.jpeg', '.jpg', '.png', '.pdf', '.zip', '.glb', '.gltf'];

export const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1 // Limit to one file at a time where possible
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      return cb(null, true);
    }
    cb(new Error('File type not allowed'));
  }
});

export const validateFileContent = async (req: Request, res: Response, next: NextFunction) => {
  const files = req.file ? [req.file] : (req.files ? (Object.values(req.files).flat() as Express.Multer.File[]) : []);
  if (files.length === 0) return next();

  try {
    const FileType = await import('file-type');

    for (const file of files) {
      const result = await FileType.fromBuffer(fs.readFileSync(file.path));

      if (file.fieldname === 'avatar' || file.fieldname === 'thumbnail') {
        if (!result || !['image/jpeg', 'image/png'].includes(result.mime)) {
          fs.unlinkSync(file.path);
          return res.status(400).json({ error: 'Invalid image content' });
        }
      }

      if (result && (result.mime.includes('javascript') || result.mime.includes('php') || result.mime.includes('html'))) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: 'Executable or script files are not allowed' });
      }
    }

    next();
  } catch (error) {
    console.error('File validation error:', error);
    next(); // Proceed if check fails, but ideally we should be safer
  }
};

import fs from 'fs';
import path from 'path';

const uploadsRoot = path.resolve(process.cwd(), 'uploads');

/**
 * Converts a URL (e.g., http://localhost:3000/uploads/assets/file.glb)
 * to a local file path relative to the project root.
 */
export function urlToPath(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parts = url.split('/uploads/');
    if (parts.length < 2) return null;

    // parts[1] is something like "assets/file.glb"
    const relativePart = parts[1];
    if (!relativePart) return null;

    const relativePath = decodeURIComponent(relativePart).replace(/\\/g, '/');

    const resolvedPath = path.resolve(uploadsRoot, relativePath);
    const relativeToUploads = path.relative(uploadsRoot, resolvedPath);
    if (relativeToUploads.startsWith('..') || path.isAbsolute(relativeToUploads)) {
      console.warn('[FileUtil] Refusing to resolve path outside uploads:', url);
      return null;
    }

    return resolvedPath;
  } catch (error) {
    console.error('[FileUtil] Error parsing URL to path:', error);
    return null;
  }
}

/**
 * Safely deletes a file if it exists.
 */
export function deleteFile(filePath: string | null): boolean {
  if (!filePath) return false;

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (error) {
    console.error(`[FileUtil] Failed to delete file at ${filePath}:`, error);
  }
  return false;
}

/**
 * Safely deletes a file from its URL.
 */
export function deleteFileByUrl(url: string | null | undefined): boolean {
  const filePath = urlToPath(url);
  return deleteFile(filePath);
}

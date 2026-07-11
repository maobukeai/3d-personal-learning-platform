/**
 * Standalone file object containing metadata and R2 cloud upload details.
 * Shared by all controllers/middlewares that handle file uploads.
 */
export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer?: Buffer;
  url?: string;
  r2Key?: string;
  r2ConfigId?: string;
}

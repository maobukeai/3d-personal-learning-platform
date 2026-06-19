/**
 * Multer file augmented with R2 cloud upload metadata.
 * Shared by all controllers/middlewares that handle file uploads.
 */
export type UploadedFile = Express.Multer.File & {
  url?: string;
  r2Key?: string;
  r2ConfigId?: string;
};

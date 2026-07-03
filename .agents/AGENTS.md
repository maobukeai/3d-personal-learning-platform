# Project Rules

## Cloud Storage Persistence Rule

1. **Mandatory Cloud Storage Adaption**: All current and future features that involve persistent storage of user-uploaded or crawler-scraped media assets (e.g., resource images, 3D model previews, textures, plugins, avatars) **MUST** support saving to cloud storage (e.g., Cloudflare R2).
2. **Check Active Storage Configs**: Never hardcode local paths like `/uploads/...` for active assets. Always check the database for active `StorageConfig` entries (matching `status: 'ACTIVE'` and the respective `assetType` or fallback to `'ALL'`).
3. **Save to Cloud with Local Fallback**: 
   - First download/write files to a temporary local path.
   - Increment storage quota limits safely inside `prisma.storageConfig.updateMany`.
   - Use `storageService.uploadFile` to transfer the files to Cloudflare R2/S3.
   - Upon successful upload, **physically delete** the local temporary file using `fs.unlinkSync(filePath)`.
   - Implement error safety: if the cloud storage upload fails or space limits are exceeded, gracefully fallback to returning the local upload path and log a warning instead of crashing the endpoint.
4. **Permissible Local Writes**: Writing files purely to local folders without uploading to the cloud is permitted ONLY for:
   - Temporary runtime caches (e.g., daily quotes, dynamic system states).
   - In-progress transaction artifacts that are immediately unlinked/deleted after being sent to WebDAV or returned to the browser (e.g., manual backup exports).

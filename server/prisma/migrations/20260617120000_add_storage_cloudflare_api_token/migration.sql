-- AlterTable
ALTER TABLE `StorageConfig` ADD COLUMN `cloudflareAccountId` VARCHAR(191) NULL,
    ADD COLUMN `cloudflareApiToken` TEXT NULL;

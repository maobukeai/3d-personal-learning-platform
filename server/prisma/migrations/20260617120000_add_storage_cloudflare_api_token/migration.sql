-- CreateTable
CREATE TABLE IF NOT EXISTS `StorageConfig` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'CLOUDFLARE_R2',
    `endpoint` VARCHAR(191) NOT NULL,
    `accessKeyId` VARCHAR(191) NOT NULL,
    `secretAccessKey` VARCHAR(191) NOT NULL,
    `bucketName` VARCHAR(191) NOT NULL,
    `publicUrl` VARCHAR(191) NOT NULL,
    `remark` VARCHAR(191) NULL,
    `limitGb` DOUBLE NOT NULL DEFAULT 9.8,
    `usedBytes` DOUBLE NOT NULL DEFAULT 0,
    `assetType` VARCHAR(191) NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StorageConfig_status_idx`(`status`),
    INDEX `StorageConfig_assetType_idx`(`assetType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `StorageConfig` ADD COLUMN `cloudflareAccountId` VARCHAR(191) NULL,
    ADD COLUMN `cloudflareApiToken` TEXT NULL;


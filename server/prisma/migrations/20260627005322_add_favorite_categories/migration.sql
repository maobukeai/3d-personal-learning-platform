-- CreateTable if not exists
CREATE TABLE IF NOT EXISTS `assetlike` (
  `id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `assetId` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `AssetLike_assetId_userId_key` (`assetId`,`userId`),
  KEY `AssetLike_userId_idx` (`userId`),
  CONSTRAINT `AssetLike_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `asset` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `AssetLike_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `assetlike` ADD COLUMN `category` VARCHAR(191) NOT NULL DEFAULT 'u9ed8u8ba4';

-- AlterTable
ALTER TABLE `materialfavorite` ADD COLUMN `category` VARCHAR(191) NOT NULL DEFAULT 'u9ed8u8ba4';

-- CreateIndex
CREATE INDEX `MaterialFavorite_userId_idx` ON `MaterialFavorite`(`userId`);

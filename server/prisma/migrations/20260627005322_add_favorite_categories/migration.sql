-- AlterTable
ALTER TABLE `assetlike` ADD COLUMN `category` VARCHAR(191) NOT NULL DEFAULT 'u9ed8u8ba4';

-- AlterTable
ALTER TABLE `materialfavorite` ADD COLUMN `category` VARCHAR(191) NOT NULL DEFAULT 'u9ed8u8ba4';

-- CreateIndex
CREATE INDEX `MaterialFavorite_userId_idx` ON `MaterialFavorite`(`userId`);

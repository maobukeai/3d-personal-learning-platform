CREATE TABLE `TutorialSection` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `startTime` DOUBLE NOT NULL DEFAULT 0,
    `endTime` DOUBLE NOT NULL DEFAULT 0,
    `order` INTEGER NOT NULL,
    `lessonId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `TutorialSection_lessonId_order_idx`(`lessonId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TutorialStep` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `startTime` DOUBLE NOT NULL DEFAULT 0,
    `endTime` DOUBLE NOT NULL DEFAULT 0,
    `screenshotTime` DOUBLE NULL,
    `order` INTEGER NOT NULL,
    `shortcuts` JSON NULL,
    `parameters` JSON NULL,
    `warnings` JSON NULL,
    `imageUrl` TEXT NULL,
    `imageKey` VARCHAR(191) NULL,
    `imageSize` INTEGER NULL,
    `storageConfigId` VARCHAR(191) NULL,
    `sectionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `TutorialStep_sectionId_order_idx`(`sectionId`, `order`),
    INDEX `TutorialStep_storageConfigId_idx`(`storageConfigId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TutorialSection` ADD CONSTRAINT `TutorialSection_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `Lesson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TutorialStep` ADD CONSTRAINT `TutorialStep_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `TutorialSection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

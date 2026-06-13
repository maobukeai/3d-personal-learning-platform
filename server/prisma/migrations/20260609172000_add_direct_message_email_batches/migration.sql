CREATE TABLE `DirectMessageEmailBatch` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `pendingCount` INTEGER NOT NULL DEFAULT 0,
    `previewItems` TEXT NOT NULL,
    `lastSenderName` VARCHAR(191) NULL,
    `conversationName` VARCHAR(191) NULL,
    `isGroup` BOOLEAN NOT NULL DEFAULT false,
    `firstQueuedAt` DATETIME(3) NULL,
    `lastQueuedAt` DATETIME(3) NULL,
    `scheduledFor` DATETIME(3) NULL,
    `processingAt` DATETIME(3) NULL,
    `lastSentAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DirectMessageEmailBatch_userId_conversationId_key`(`userId`, `conversationId`),
    INDEX `DirectMessageEmailBatch_scheduledFor_idx`(`scheduledFor`),
    INDEX `DirectMessageEmailBatch_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

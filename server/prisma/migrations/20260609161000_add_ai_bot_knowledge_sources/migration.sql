CREATE TABLE `AiBotKnowledgeSource` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `integrationId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `sourceType` VARCHAR(191) NOT NULL DEFAULT 'FAQ',
  `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  `visibility` VARCHAR(191) NOT NULL DEFAULT 'PRIVATE',
  `content` TEXT NOT NULL,
  `url` TEXT NULL,
  `tags` TEXT NULL,
  `priority` INTEGER NOT NULL DEFAULT 50,
  `tokenEstimate` INTEGER NOT NULL DEFAULT 0,
  `lastIndexedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `AiBotKnowledgeSource_userId_updatedAt_idx` (`userId`, `updatedAt`),
  INDEX `AiBotKnowledgeSource_integrationId_status_priority_idx` (`integrationId`, `status`, `priority`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AiBotKnowledgeSource`
  ADD CONSTRAINT `AiBotKnowledgeSource_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `AiBotKnowledgeSource`
  ADD CONSTRAINT `AiBotKnowledgeSource_integrationId_fkey`
  FOREIGN KEY (`integrationId`) REFERENCES `AiBotIntegration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

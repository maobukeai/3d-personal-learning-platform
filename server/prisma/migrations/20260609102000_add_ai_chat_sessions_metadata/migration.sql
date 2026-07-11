-- CreateTable
CREATE TABLE `AiChatSession` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL DEFAULT 'New conversation',
  `summary` TEXT NULL,
  `tags` TEXT NULL,
  `mode` VARCHAR(191) NOT NULL DEFAULT 'default',
  `pinned` BOOLEAN NOT NULL DEFAULT false,
  `archived` BOOLEAN NOT NULL DEFAULT false,
  `lastMessageAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `AiChatSession_userId_pinned_archived_lastMessageAt_idx`(`userId`, `pinned`, `archived`, `lastMessageAt`),
  PRIMARY KEY (`userId`, `id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AiChatSession` ADD CONSTRAINT `AiChatSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

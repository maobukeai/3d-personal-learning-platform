-- CreateTable
CREATE TABLE `AiBotIntegration` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `platform` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  `webhookUrl` TEXT NULL,
  `secret` TEXT NULL,
  `publicToken` VARCHAR(191) NOT NULL,
  `triggerKeywords` TEXT NULL,
  `systemPrompt` TEXT NULL,
  `responseMode` VARCHAR(191) NOT NULL DEFAULT 'CALLBACK_AND_WEBHOOK',
  `lastUsedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `AiBotIntegration_publicToken_key`(`publicToken`),
  INDEX `AiBotIntegration_userId_idx`(`userId`),
  INDEX `AiBotIntegration_platform_status_idx`(`platform`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiBotMessage` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `integrationId` VARCHAR(191) NOT NULL,
  `platform` VARCHAR(191) NOT NULL,
  `externalUserId` VARCHAR(191) NULL,
  `externalConversationId` VARCHAR(191) NULL,
  `inboundText` TEXT NOT NULL,
  `outboundText` TEXT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'SUCCESS',
  `error` TEXT NULL,
  `inputChars` INTEGER NOT NULL DEFAULT 0,
  `outputChars` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `AiBotMessage_userId_createdAt_idx`(`userId`, `createdAt`),
  INDEX `AiBotMessage_integrationId_createdAt_idx`(`integrationId`, `createdAt`),
  INDEX `AiBotMessage_platform_status_idx`(`platform`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AiBotIntegration` ADD CONSTRAINT `AiBotIntegration_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiBotMessage` ADD CONSTRAINT `AiBotMessage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiBotMessage` ADD CONSTRAINT `AiBotMessage_integrationId_fkey` FOREIGN KEY (`integrationId`) REFERENCES `AiBotIntegration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

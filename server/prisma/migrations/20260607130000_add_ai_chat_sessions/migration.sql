ALTER TABLE `AiMessage`
  ADD COLUMN `sessionId` VARCHAR(191) NOT NULL DEFAULT 'default',
  ADD COLUMN `sessionTitle` VARCHAR(191) NOT NULL DEFAULT '新对话';

CREATE INDEX `AiMessage_userId_sessionId_createdAt_idx`
  ON `AiMessage`(`userId`, `sessionId`, `createdAt`);

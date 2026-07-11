-- Add metadata required for a user-facing trusted-device security view.
ALTER TABLE `TrustedDevice`
  ADD COLUMN `userAgent` TEXT NULL,
  ADD COLUMN `ipAddress` VARCHAR(191) NULL,
  ADD COLUMN `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE INDEX `TrustedDevice_userId_lastUsedAt_idx`
  ON `TrustedDevice`(`userId`, `lastUsedAt`);

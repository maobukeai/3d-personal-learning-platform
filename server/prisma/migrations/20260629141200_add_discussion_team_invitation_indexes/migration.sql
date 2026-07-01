-- CreateIndex
CREATE INDEX `Discussion_createdAt_idx` ON `Discussion`(`createdAt`);

-- CreateIndex
CREATE INDEX `TeamInvitation_inviteeEmail_idx` ON `TeamInvitation`(`inviteeEmail`);

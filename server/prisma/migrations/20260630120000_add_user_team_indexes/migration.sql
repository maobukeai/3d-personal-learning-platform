-- CreateIndex
-- Indexes for frequently-filtered User columns (admin user list, dashboard stats)
CREATE INDEX `User_role_idx` ON `User`(`role`);

-- CreateIndex
CREATE INDEX `User_status_idx` ON `User`(`status`);

-- CreateIndex
CREATE INDEX `User_createdAt_idx` ON `User`(`createdAt`);

-- CreateIndex
-- Index for Team.type, used to filter PERSONAL vs TEAM in many admin/team queries
CREATE INDEX `Team_type_idx` ON `Team`(`type`);

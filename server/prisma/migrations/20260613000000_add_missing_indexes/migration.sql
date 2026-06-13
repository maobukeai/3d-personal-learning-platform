-- CreateIndex
CREATE INDEX `Feedback_userId_idx` ON `Feedback`(`userId`);

-- CreateIndex
CREATE INDEX `Material_userId_idx` ON `Material`(`userId`);

-- CreateIndex
CREATE INDEX `Course_status_idx` ON `Course`(`status`);

-- CreateIndex
CREATE INDEX `Course_categoryId_idx` ON `Course`(`categoryId`);

-- CreateIndex
CREATE INDEX `Note_category_idx` ON `Note`(`category`);

-- CreateIndex
CREATE INDEX `AiMessage_sessionId_idx` ON `AiMessage`(`sessionId`);

-- CreateIndex
CREATE INDEX `Showcase_status_idx` ON `Showcase`(`status`);

-- CreateIndex
CREATE INDEX `Asset_type_idx` ON `Asset`(`type`);

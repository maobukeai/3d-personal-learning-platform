-- CreateTable
CREATE TABLE "ActivationCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "usedById" TEXT,
    "usedAt" DATETIME,
    "expiresAt" DATETIME,
    "bindEmail" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivationCode_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivationCode_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MirrorResourceComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MirrorResourceComment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "MirrorResource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MirrorResourceComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MirrorResourceLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MirrorResourceLike_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "MirrorResource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MirrorResourceLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManualStation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "totalResources" INTEGER NOT NULL DEFAULT 0,
    "minPlanPriority" INTEGER NOT NULL DEFAULT 1,
    "iconUrl" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ManualCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "resourceCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManualCategory_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "ManualStation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ManualCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ManualCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManualResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stationId" TEXT NOT NULL,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "contentUrl" TEXT,
    "tags" TEXT,
    "contentHtml" TEXT,
    "resourceType" TEXT NOT NULL DEFAULT 'COURSE',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManualResource_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "ManualStation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ManualResource_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ManualCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManualResourceComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManualResourceComment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "ManualResource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ManualResourceComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManualResourceLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManualResourceLike_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "ManualResource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ManualResourceLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivationCode_code_key" ON "ActivationCode"("code");

-- CreateIndex
CREATE INDEX "ActivationCode_planId_idx" ON "ActivationCode"("planId");

-- CreateIndex
CREATE INDEX "ActivationCode_usedById_idx" ON "ActivationCode"("usedById");

-- CreateIndex
CREATE UNIQUE INDEX "MirrorResourceLike_resourceId_userId_key" ON "MirrorResourceLike"("resourceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualStation_name_key" ON "ManualStation"("name");

-- CreateIndex
CREATE INDEX "ManualCategory_stationId_idx" ON "ManualCategory"("stationId");

-- CreateIndex
CREATE INDEX "ManualResource_stationId_categoryId_idx" ON "ManualResource"("stationId", "categoryId");

-- CreateIndex
CREATE INDEX "ManualResource_title_idx" ON "ManualResource"("title");

-- CreateIndex
CREATE INDEX "ManualResourceComment_resourceId_idx" ON "ManualResourceComment"("resourceId");

-- CreateIndex
CREATE INDEX "ManualResourceComment_userId_idx" ON "ManualResourceComment"("userId");

-- CreateIndex
CREATE INDEX "ManualResourceLike_resourceId_idx" ON "ManualResourceLike"("resourceId");

-- CreateIndex
CREATE INDEX "ManualResourceLike_userId_idx" ON "ManualResourceLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualResourceLike_resourceId_userId_key" ON "ManualResourceLike"("resourceId", "userId");

-- CreateIndex
CREATE INDEX "Asset_userId_idx" ON "Asset"("userId");

-- CreateIndex
CREATE INDEX "Asset_categoryId_idx" ON "Asset"("categoryId");

-- CreateIndex
CREATE INDEX "Asset_teamId_idx" ON "Asset"("teamId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "Comment_userId_idx" ON "Comment"("userId");

-- CreateIndex
CREATE INDEX "Comment_discussionId_idx" ON "Comment"("discussionId");

-- CreateIndex
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");

-- CreateIndex
CREATE INDEX "CommentLike_userId_idx" ON "CommentLike"("userId");

-- CreateIndex
CREATE INDEX "CourseNote_userId_lessonId_idx" ON "CourseNote"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "CourseReview_courseId_idx" ON "CourseReview"("courseId");

-- CreateIndex
CREATE INDEX "Discussion_userId_idx" ON "Discussion"("userId");

-- CreateIndex
CREATE INDEX "Discussion_courseId_idx" ON "Discussion"("courseId");

-- CreateIndex
CREATE INDEX "DiscussionLike_userId_idx" ON "DiscussionLike"("userId");

-- CreateIndex
CREATE INDEX "LessonProgress_userId_idx" ON "LessonProgress"("userId");

-- CreateIndex
CREATE INDEX "MirrorResource_sourceId_categoryId_idx" ON "MirrorResource"("sourceId", "categoryId");

-- CreateIndex
CREATE INDEX "MirrorResource_title_idx" ON "MirrorResource"("title");

-- CreateIndex
CREATE INDEX "MirrorResource_syncedAt_idx" ON "MirrorResource"("syncedAt");

-- CreateIndex
CREATE INDEX "Note_userId_idx" ON "Note"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Project_teamId_idx" ON "Project"("teamId");

-- CreateIndex
CREATE INDEX "ProjectInvitation_projectId_inviteeId_idx" ON "ProjectInvitation"("projectId", "inviteeId");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "Showcase_assetId_idx" ON "Showcase"("assetId");

-- CreateIndex
CREATE INDEX "Showcase_userId_idx" ON "Showcase"("userId");

-- CreateIndex
CREATE INDEX "Showcase_teamId_idx" ON "Showcase"("teamId");

-- CreateIndex
CREATE INDEX "ShowcaseComment_showcaseId_userId_idx" ON "ShowcaseComment"("showcaseId", "userId");

-- CreateIndex
CREATE INDEX "ShowcaseLike_userId_idx" ON "ShowcaseLike"("userId");

-- CreateIndex
CREATE INDEX "Task_userId_idx" ON "Task"("userId");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- CreateIndex
CREATE INDEX "Task_teamId_idx" ON "Task"("teamId");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "TaskParticipant_userId_idx" ON "TaskParticipant"("userId");

-- CreateIndex
CREATE INDEX "TeamInvitation_teamId_idx" ON "TeamInvitation"("teamId");

-- CreateIndex
CREATE INDEX "TrustedDevice_userId_idx" ON "TrustedDevice"("userId");

-- CreateIndex
CREATE INDEX "VerificationCode_email_idx" ON "VerificationCode"("email");


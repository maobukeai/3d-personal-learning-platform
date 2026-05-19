-- CreateTable
CREATE TABLE "MirrorSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "adapterType" TEXT NOT NULL DEFAULT 'GENERIC_WP',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "syncStatus" TEXT NOT NULL DEFAULT 'IDLE',
    "lastSyncAt" DATETIME,
    "lastSyncDuration" INTEGER,
    "totalResources" INTEGER NOT NULL DEFAULT 0,
    "syncInterval" INTEGER NOT NULL DEFAULT 3600,
    "syncConfig" TEXT,
    "minPlanPriority" INTEGER NOT NULL DEFAULT 1,
    "iconUrl" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MirrorCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "parentExternalId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "resourceCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MirrorCategory_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MirrorSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MirrorResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "contentUrl" TEXT,
    "tags" TEXT,
    "externalData" TEXT,
    "resourceType" TEXT NOT NULL DEFAULT 'COURSE',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" DATETIME,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MirrorResource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MirrorSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MirrorResource_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MirrorCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "duration" INTEGER,
    "resourcesFound" INTEGER NOT NULL DEFAULT 0,
    "resourcesCreated" INTEGER NOT NULL DEFAULT 0,
    "resourcesUpdated" INTEGER NOT NULL DEFAULT 0,
    "resourcesDeleted" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncLog_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MirrorSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MirrorSource_name_key" ON "MirrorSource"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MirrorCategory_sourceId_externalId_key" ON "MirrorCategory"("sourceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "MirrorResource_sourceId_externalId_key" ON "MirrorResource"("sourceId", "externalId");

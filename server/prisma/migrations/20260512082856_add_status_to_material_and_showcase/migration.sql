-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "resolution" TEXT,
    "previewUrl" TEXT,
    "fileUrl" TEXT NOT NULL,
    "tags" TEXT,
    "isProcedural" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Material_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Material" ("category", "createdAt", "fileUrl", "id", "isProcedural", "previewUrl", "resolution", "tags", "title", "updatedAt", "userId") SELECT "category", "createdAt", "fileUrl", "id", "isProcedural", "previewUrl", "resolution", "tags", "title", "updatedAt", "userId" FROM "Material";
DROP TABLE "Material";
ALTER TABLE "new_Material" RENAME TO "Material";
CREATE TABLE "new_Showcase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "videoUrl" TEXT,
    "isVideo" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Showcase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Showcase" ("createdAt", "id", "isVideo", "thumbnailUrl", "title", "updatedAt", "userId", "videoUrl", "views") SELECT "createdAt", "id", "isVideo", "thumbnailUrl", "title", "updatedAt", "userId", "videoUrl", "views" FROM "Showcase";
DROP TABLE "Showcase";
ALTER TABLE "new_Showcase" RENAME TO "Showcase";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "website" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("avatarUrl", "bio", "createdAt", "email", "emailVerified", "id", "location", "name", "password", "role", "twoFactorEnabled", "twoFactorSecret", "updatedAt", "website") SELECT "avatarUrl", "bio", "createdAt", "email", "emailVerified", "id", "location", "name", "password", "role", "twoFactorEnabled", "twoFactorSecret", "updatedAt", "website" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

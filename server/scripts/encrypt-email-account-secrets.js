const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ quiet: true });

const ENCRYPTED_PREFIX = 'enc:v1:';
const prisma = new PrismaClient();

const getKey = () => {
  const secret = process.env.DATABASE_ENCRYPTION_KEY || process.env.EMAIL_ACCOUNT_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('DATABASE_ENCRYPTION_KEY is required before encrypting stored email secrets.');
  }
  return crypto.createHash('sha256').update(secret).digest();
};

const encryptSecret = (value, key) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
};

const main = async () => {
  const key = getKey();
  const accounts = await prisma.microsoftEmailAccount.findMany({
    where: {
      password: {
        not: null,
      },
    },
    select: {
      id: true,
      password: true,
    },
  });

  const plaintextAccounts = accounts.filter(
    (account) => account.password && !account.password.startsWith(ENCRYPTED_PREFIX),
  );

  for (const account of plaintextAccounts) {
    await prisma.microsoftEmailAccount.update({
      where: { id: account.id },
      data: { password: encryptSecret(account.password, key) },
    });
  }

  console.log(
    JSON.stringify(
      {
        checked: accounts.length,
        encrypted: plaintextAccounts.length,
      },
      null,
      2,
    ),
  );
};

main()
  .catch((error) => {
    console.error('Failed to encrypt email account secrets:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

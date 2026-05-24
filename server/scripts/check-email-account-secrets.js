const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ quiet: true });

const ENCRYPTED_PREFIX = 'enc:v1:';
const prisma = new PrismaClient();

const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email || '(unknown)';
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}***@${domain}`;
};

const main = async () => {
  const failOnPlaintext = process.argv.includes('--fail-on-plaintext');
  const accounts = await prisma.microsoftEmailAccount.findMany({
    select: {
      id: true,
      email: true,
      status: true,
      password: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const withPassword = accounts.filter((account) => account.password);
  const encrypted = withPassword.filter((account) => account.password.startsWith(ENCRYPTED_PREFIX));
  const plaintext = withPassword.filter(
    (account) => !account.password.startsWith(ENCRYPTED_PREFIX),
  );

  console.log(
    JSON.stringify(
      {
        checked: accounts.length,
        withPassword: withPassword.length,
        encrypted: encrypted.length,
        plaintext: plaintext.length,
        plaintextAccounts: plaintext.map((account) => ({
          id: account.id,
          email: maskEmail(account.email),
          status: account.status,
          createdAt: account.createdAt,
        })),
      },
      null,
      2,
    ),
  );

  if (plaintext.length > 0) {
    console.warn(
      `Found ${plaintext.length} email account password value(s) that do not use ${ENCRYPTED_PREFIX}. Re-save or re-import these accounts after DATABASE_ENCRYPTION_KEY is configured.`,
    );
    if (failOnPlaintext) process.exitCode = 1;
  }
};

main()
  .catch((error) => {
    console.error('Failed to check email account secrets:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

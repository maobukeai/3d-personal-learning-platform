import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

async function main() {
  const settings = await prisma.systemSetting.findMany();
  console.log('System Settings:', JSON.stringify(settings, null, 2));

  const userSettings = await prisma.userSetting.findMany();
  console.log('User Settings:', JSON.stringify(userSettings, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

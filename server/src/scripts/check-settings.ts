import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const settings = await prisma.systemSetting.findMany();
  console.log('Current System Settings:');
  console.table(settings);
  await prisma.$disconnect();
}

check();

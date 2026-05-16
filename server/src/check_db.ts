import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRaw`PRAGMA table_info(Showcase)`;
    console.log('Discussion table info:', result);
  } catch (error) {
    console.error('Failed to query table info:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

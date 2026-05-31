/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const columns: any[] = await prisma.$queryRawUnsafe(`
      SHOW COLUMNS FROM noteshare
    `);
    console.log('noteshare columns:', JSON.stringify(columns, null, 2));
  } catch (error) {
    console.error('Failed to list columns:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

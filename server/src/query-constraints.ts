/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRawUnsafe(`
      SELECT CONSTRAINT_SCHEMA, TABLE_NAME, CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_NAME = 'MaterialFavorite_materialId_fkey'
    `);
    console.log('Duplicate constraints:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Failed to query constraints:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const tables = ['Showcase', 'Asset', 'Notification', 'Material'];
    for (const table of tables) {
      console.log(`--- ${table} ---`);
      const result = await prisma.$queryRawUnsafe(`PRAGMA table_info(${table});`);
      console.log(JSON.stringify(result, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();

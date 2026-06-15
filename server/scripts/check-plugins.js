const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.plugin.count();
  console.log('--- PLUGINS COUNT IN DB:', count);
  const plugins = await prisma.plugin.findMany();
  console.log('--- PLUGINS:', JSON.stringify(plugins, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

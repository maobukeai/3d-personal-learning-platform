const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const sources = await prisma.mirrorSource.findMany();
    console.log('--- Current Mirror Sources ---');
    for (const src of sources) {
      const total = await prisma.mirrorResource.count({ where: { sourceId: src.id } });
      const local = await prisma.mirrorResource.count({
        where: {
          sourceId: src.id,
          thumbnailUrl: { startsWith: '/uploads/' }
        }
      });
      const remote = await prisma.mirrorResource.count({
        where: {
          sourceId: src.id,
          thumbnailUrl: { startsWith: 'http' }
        }
      });
      
      console.log(`Source ID: ${src.id}`);
      console.log(`Name: ${src.name} (${src.displayName})`);
      console.log(`Status: ${src.status}`);
      console.log(`Sync Status: ${src.syncStatus}`);
      console.log(`Resources Total: ${total}`);
      console.log(`Local Images: ${local}`);
      console.log(`Remote HTTP Images: ${remote}`);
    }

    console.log('\n--- Recent Sync Logs ---');
    const logs = await prisma.syncLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 5
    });
    for (const log of logs) {
      console.log(`Log ID: ${log.id}`);
      console.log(`Source ID: ${log.sourceId}`);
      console.log(`Status: ${log.status}`);
      console.log(`Started: ${log.startedAt.toISOString()}`);
      console.log(`Finished: ${log.finishedAt ? log.finishedAt.toISOString() : 'N/A'}`);
      console.log(`Error: ${log.error || 'None'}`);
      console.log(`Found/Created/Updated: ${log.resourcesFound}/${log.resourcesCreated}/${log.resourcesUpdated}`);
      console.log('----------------------');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

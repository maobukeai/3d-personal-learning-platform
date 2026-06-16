import prisma from '../services/prisma';

async function main() {
  console.log('--- Checking StorageConfigs ---');
  const configs = await prisma.storageConfig.findMany();
  console.log(JSON.stringify(configs, null, 2));

  console.log('\n--- Checking Latest Assets ---');
  const assets = await prisma.asset.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log(JSON.stringify(assets, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());

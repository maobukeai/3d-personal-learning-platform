import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const assets = await prisma.asset.findMany();
  assets.forEach((a) => {
    console.log(`Asset ID: ${a.id}, Title: ${a.title}, URL: ${a.url}, Thumbnail: ${a.thumbnail}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

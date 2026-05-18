import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const assets = await prisma.asset.findMany({
    where: {
      OR: [
        { url: { contains: '商标' } },
        { url: { contains: '相框' } },
        { url: { contains: '书' } },
        { thumbnail: { contains: '商标' } },
        { thumbnail: { contains: '相框' } },
        { thumbnail: { contains: '书' } },
      ],
    },
  });

  console.log('Found Assets:', JSON.stringify(assets, null, 2));

  const showcases = await prisma.showcase.findMany({
    where: {
      OR: [
        { thumbnailUrl: { contains: '商标' } },
        { thumbnailUrl: { contains: '相框' } },
        { thumbnailUrl: { contains: '书' } },
        { images: { contains: '商标' } },
        { images: { contains: '相框' } },
        { images: { contains: '书' } },
      ],
    },
  });

  console.log('Found Showcases:', JSON.stringify(showcases, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

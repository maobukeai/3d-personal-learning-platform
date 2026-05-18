import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const showcases = await prisma.showcase.findMany();
  showcases.forEach((s) => {
    console.log(`Showcase ID: ${s.id}, Title: ${s.title}, Thumbnail: ${s.thumbnailUrl}`);
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

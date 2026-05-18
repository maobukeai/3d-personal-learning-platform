import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const materials = await prisma.material.findMany({
    where: {
      OR: [
        { title: { contains: '相框' } },
        { title: { contains: '书' } },
        { title: { contains: '商标' } },
        { previewUrl: { contains: '相框' } },
        { previewUrl: { contains: '书' } },
        { previewUrl: { contains: '商标' } },
      ],
    },
  });

  console.log('Found Materials:', JSON.stringify(materials, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

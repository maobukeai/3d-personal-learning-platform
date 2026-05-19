import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { description: { contains: '商标' } },
        { description: { contains: '相框' } },
        { description: { contains: '书' } },
        { newValue: { contains: '商标' } },
        { newValue: { contains: '相框' } },
        { newValue: { contains: '书' } },
      ],
    },
    take: 10,
  });

  console.log('Found AuditLogs:', JSON.stringify(logs, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

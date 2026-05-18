import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

async function main() {
  const tables = [
    'user',
    'team',
    'asset',
    'category',
    'course',
    'courseCategory',
    'lesson',
    'enrollment',
    'discussion',
    'comment',
    'task',
    'feedback',
    'project',
    'projectDiscussion',
    'material',
    'showcase',
    'note',
    'auditLog',
  ];

  const searchString = '(2)';

  for (const table of tables) {
    const model = prisma[table];
    if (!model) continue;

    try {
      const allRecords = await model.findMany();
      for (const record of allRecords) {
        if (JSON.stringify(record).includes(searchString)) {
          console.log(`Table ${table} has a match for "${searchString}":`);
          console.log(JSON.stringify(record, null, 2));
        }
      }
    } catch (e) {}
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

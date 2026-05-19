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

  const searchStrings = ['%E5%95%86%E6%A0%87', '%E7%9B%B8%E6%A1%86', '%E4%B9%A6'];

  for (const table of tables) {
    const model = prisma[table];
    if (!model) continue;

    try {
      const allRecords = await model.findMany();
      for (const record of allRecords) {
        const recordStr = JSON.stringify(record);
        for (const searchString of searchStrings) {
          if (recordStr.includes(searchString)) {
            console.log(`Table ${table} has a match for "${searchString}":`);
            console.log(JSON.stringify(record, null, 2));
            break;
          }
        }
      }
    } catch (e) {
      // console.error(`Error searching table ${table}:`, e);
    }
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

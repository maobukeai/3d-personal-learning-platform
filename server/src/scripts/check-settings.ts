import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fix() {
  const settings = await prisma.systemSetting.findMany();
  console.log('Current System Settings:');
  console.table(settings);

  for (const s of settings) {
    if (s.key === 'ALLOWED_EXTENSIONS' && !s.value.startsWith('[')) {
      const arrayValue = s.value.split(',').map(ext => ext.trim());
      await prisma.systemSetting.update({
        where: { id: s.id },
        data: { value: JSON.stringify(arrayValue) }
      });
      console.log(`Fixed ${s.key}`);
    }
  }

  const finalSettings = await prisma.systemSetting.findMany();
  console.log('Updated System Settings:');
  console.table(finalSettings);
  
  await prisma.$disconnect();
}

fix();

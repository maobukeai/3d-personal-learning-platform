const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updatePlanNames() {
  console.log('Updating plan names in database...');
  try {
    await prisma.subscriptionPlan.updateMany({
      where: { name: 'FREE' },
      data: { name: '免费' }
    });
    await prisma.subscriptionPlan.updateMany({
      where: { name: 'PRO' },
      data: { name: 'VIP' }
    });
    await prisma.subscriptionPlan.updateMany({
      where: { name: 'ENTERPRISE' },
      data: { name: 'SVIP' }
    });
    console.log('Plan names updated successfully.');
  } catch (error) {
    console.error('Error updating plan names:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePlanNames();

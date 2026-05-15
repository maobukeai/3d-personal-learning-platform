import prisma from './services/prisma';

async function main() {
  try {
    const userCount = await prisma.user.count();
    console.log('User count:', userCount);

    const users = await prisma.user.findMany({ take: 1 });
    console.log('First user:', users[0]?.email);
  } catch (error) {
    console.error('Prisma connection error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

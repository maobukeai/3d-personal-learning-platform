import prisma from './services/prisma';

async function main() {
  try {
    console.log('Testing getDiscussionTags query...');
    const discussions = await prisma.discussion.findMany({
      where: { tags: { not: null } },
      select: { tags: true },
    });
    console.log('Results count:', discussions.length);
    console.log('First result:', discussions[0]);
  } catch (error) {
    console.error('Query failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

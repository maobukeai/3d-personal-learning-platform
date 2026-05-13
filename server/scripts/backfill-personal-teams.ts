import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill of personal teams for existing users...');

  // 查找没有个人团队的用户
  const users = await prisma.user.findMany({
    include: {
      ownedTeams: true
    }
  });

  console.log(`Found ${users.length} users in total.`);

  let createdCount = 0;

  for (const user of users) {
    // 检查用户是否已经有个人团队
    const hasPersonalTeam = user.ownedTeams.some(team => team.type === 'PERSONAL');
    
    if (!hasPersonalTeam) {
      console.log(`Creating personal team for user: ${user.email} (${user.id})`);
      
      try {
        await prisma.team.create({
          data: {
            name: `${user.name || user.email} 的个人空间`,
            description: '个人专属创作与协作空间',
            type: 'PERSONAL',
            visibility: 'PRIVATE',
            ownerId: user.id,
            members: {
              create: {
                userId: user.id,
                role: 'OWNER'
              }
            }
          }
        });
        
        createdCount++;
        console.log(`Successfully created personal team for: ${user.email}`);
      } catch (error) {
        console.error(`Error creating personal team for ${user.email}:`, error);
      }
    }
  }

  console.log(`Backfill completed. Created ${createdCount} personal teams.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

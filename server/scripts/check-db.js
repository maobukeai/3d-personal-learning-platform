const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const userCount = await prisma.user.count();
    const assetCount = await prisma.asset.count();
    const materialCount = await prisma.material.count();
    const showcaseCount = await prisma.showcase.count();
    const teamCount = await prisma.team.count();
    const teamMemberCount = await prisma.teamMember.count();

    console.log('=== Database Status ===');
    console.log(`Users: ${userCount}`);
    console.log(`Assets: ${assetCount}`);
    console.log(`Materials: ${materialCount}`);
    console.log(`Showcases: ${showcaseCount}`);
    console.log(`Teams: ${teamCount}`);
    console.log(`TeamMembers: ${teamMemberCount}`);

    console.log('\n=== Users List ===');
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true }
    });
    console.log(JSON.stringify(users, null, 2));

    console.log('\n=== Teams List ===');
    const teams = await prisma.team.findMany({
      include: {
        members: {
          include: {
            user: { select: { name: true, email: true } }
          }
        }
      }
    });
    console.log(JSON.stringify(teams, null, 2));

    console.log('\n=== Assets Sample ===');
    const assets = await prisma.asset.findMany({
      take: 5,
      select: { id: true, title: true, userId: true, teamId: true, status: true }
    });
    console.log(JSON.stringify(assets, null, 2));

    console.log('\n=== Materials Sample ===');
    const materials = await prisma.material.findMany({
      take: 5,
      select: { id: true, title: true, userId: true, teamId: true, status: true }
    });
    console.log(JSON.stringify(materials, null, 2));

    console.log('\n=== Showcases Sample ===');
    const showcases = await prisma.showcase.findMany({
      take: 5,
      select: { id: true, title: true, userId: true, teamId: true, status: true }
    });
    console.log(JSON.stringify(showcases, null, 2));

  } catch (err) {
    console.error('Error running check-db:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

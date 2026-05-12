const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function mergePersonalTeams() {
  console.log('开始合并“个人空间”团队...');
  
  try {
    // 1. 获取所有“个人空间”团队
    const personalTeams = await prisma.team.findMany({
      where: { name: '个人空间' }
    });

    if (personalTeams.length === 0) {
      console.log('未发现“个人空间”团队，无需合并。');
      return;
    }

    console.log(`发现 ${personalTeams.length} 个“个人空间”团队。`);

    // 2. 创建或寻找一个统一的“公共空间”团队
    let targetTeam = await prisma.team.findFirst({
      where: { name: '公共空间', type: 'TEAM' }
    });

    if (!targetTeam) {
      console.log('创建统一的“公共空间”团队...');
      targetTeam = await prisma.team.create({
        data: {
          name: '公共空间',
          description: '由系统合并生成的公共协作空间',
          type: 'TEAM',
          visibility: 'PUBLIC',
          ownerId: personalTeams[0].ownerId // 使用第一个发现的用户作为名义负责人
        }
      });
    }

    const targetTeamId = targetTeam.id;

    // 3. 迁移所有关联数据
    for (const team of personalTeams) {
      if (team.id === targetTeamId) continue;

      console.log(`正在迁移团队数据: ${team.id} (${team.name}) -> ${targetTeamId}`);

      // 迁移成员 (upsert 以免重复)
      const members = await prisma.teamMember.findMany({ where: { teamId: team.id } });
      for (const member of members) {
        await prisma.teamMember.upsert({
          where: { teamId_userId: { teamId: targetTeamId, userId: member.userId } },
          update: {},
          create: {
            teamId: targetTeamId,
            userId: member.userId,
            role: member.role === 'OWNER' ? 'MEMBER' : member.role // 原所有者变为成员
          }
        });
      }

      // 迁移资产
      await prisma.asset.updateMany({
        where: { teamId: team.id },
        data: { teamId: targetTeamId }
      });

      // 迁移任务
      await prisma.task.updateMany({
        where: { teamId: team.id },
        data: { teamId: targetTeamId }
      });

      // 迁移项目
      await prisma.project.updateMany({
        where: { teamId: team.id },
        data: { teamId: targetTeamId }
      });

      // 迁移材料
      await prisma.material.updateMany({
        where: { teamId: team.id },
        data: { teamId: targetTeamId }
      });

      // 迁移课程进度/注册
      await prisma.enrollment.updateMany({
        where: { teamId: team.id },
        data: { teamId: targetTeamId }
      });

      // 迁移申请
      await prisma.teamApplication.updateMany({
        where: { teamId: team.id },
        data: { teamId: targetTeamId }
      });

      // 4. 删除旧团队
      await prisma.team.delete({ where: { id: team.id } });
    }

    console.log('合并完成！');
  } catch (error) {
    console.error('合并过程中出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

mergePersonalTeams();

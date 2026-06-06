/**
 * One-time migration script: retroactively calculates and sets points for all existing users.
 *
 * Run this ONCE after deploying the points system to assign historical points.
 * Safe to inspect results with --dry-run before committing changes.
 *
 * Usage:
 *   npx ts-node scripts/retroactive-points.ts
 *   npx ts-node scripts/retroactive-points.ts --dry-run
 */
import { PrismaClient } from '@prisma/client';
import { POINTS_RULES, PointsAction } from '../src/services/points.service';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

const BASE_POINTS = 50; // Starting points for every existing user

async function main() {
  console.log(`--- Starting Retroactive Points Calculation ${isDryRun ? '[DRY RUN]' : ''} ---`);
  const users = await prisma.user.findMany();

  for (const user of users) {
    const discussionCount = await prisma.discussion.count({ where: { userId: user.id } });
    const commentCount =
      (await prisma.comment.count({ where: { userId: user.id } })) +
      (await prisma.showcaseComment.count({ where: { userId: user.id } }));
    const discussionLikesCount = await prisma.discussionLike.count({ where: { userId: user.id } });
    const commentLikesCount = await prisma.commentLike.count({ where: { userId: user.id } });
    const showcaseLikesCount = await prisma.showcaseLike.count({ where: { userId: user.id } });
    const completedLessonsCount = await prisma.lessonProgress.count({
      where: { userId: user.id, completed: true },
    });
    const completedTasksCount = await prisma.task.count({
      where: { userId: user.id, status: 'DONE' },
    });
    const showcasesCount = await prisma.showcase.count({ where: { userId: user.id } });

    const earnedPoints =
      discussionCount * POINTS_RULES[PointsAction.CREATE_DISCUSSION] +
      commentCount * POINTS_RULES[PointsAction.CREATE_COMMENT] +
      (discussionLikesCount + commentLikesCount + showcaseLikesCount) *
        POINTS_RULES[PointsAction.LIKE_CONTENT] +
      completedLessonsCount * POINTS_RULES[PointsAction.COMPLETE_LESSON] +
      completedTasksCount * POINTS_RULES[PointsAction.COMPLETE_TASK] +
      showcasesCount * POINTS_RULES[PointsAction.PUBLISH_SHOWCASE];

    const newPoints = BASE_POINTS + earnedPoints;

    if (!isDryRun) {
      await prisma.user.update({
        where: { id: user.id },
        data: { points: newPoints },
      });
    }
    console.log(
      `[${isDryRun ? 'DRY RUN' : 'UPDATED'}] User [${user.name || user.email}]: points = ${newPoints} (earned ${earnedPoints} + ${BASE_POINTS} base)`,
    );
  }
  console.log(`--- Retroactive Points Calculation Completed ${isDryRun ? '[DRY RUN - no changes written]' : ''} ---`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

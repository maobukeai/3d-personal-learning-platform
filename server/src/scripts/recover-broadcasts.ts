import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  // Search for notifications by content to avoid encoding issues with the title in the script run
  const notificationsByContent = await prisma.notification.findMany({
    where: {
      content: { contains: '个人噶收拾' },
      type: 'SYSTEM',
    },
  });

  if (notificationsByContent.length > 0) {
    logger.info(`Found ${notificationsByContent.length} notifications by content.`);
    const first = notificationsByContent[0];
    if (first) {
      const broadcast = await prisma.broadcast.create({
        data: {
          title: first.title,
          content: first.content,
          link: first.link,
          createdAt: first.createdAt,
        },
      });

      await prisma.notification.updateMany({
        where: { title: first.title, content: first.content, type: 'SYSTEM' },
        data: { broadcastId: broadcast.id },
      });

      logger.info(`Associated notifications with new broadcast record: ${broadcast.id}`);
    }
  } else {
    logger.info('No notifications found by content.');
  }

  // Handle the '1' case
  const notificationsOne = await prisma.notification.findMany({
    where: { title: '1', content: '1', type: 'SYSTEM', broadcastId: null },
  });

  if (notificationsOne.length > 0) {
    const firstOne = notificationsOne[0];
    if (firstOne) {
      const broadcastOne = await prisma.broadcast.create({
        data: {
          title: firstOne.title,
          content: firstOne.content,
          link: firstOne.link,
          createdAt: firstOne.createdAt,
        },
      });
      await prisma.notification.updateMany({
        where: { title: '1', content: '1', type: 'SYSTEM' },
        data: { broadcastId: broadcastOne.id },
      });
      logger.info('Associated "1" notifications.');
    }
  }
}

cleanup()
  .catch((e) => logger.error(e))
  .finally(async () => await prisma.$disconnect());

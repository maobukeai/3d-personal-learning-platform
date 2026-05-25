import { logger } from '../../utils/logger';
import prisma from '../../services/prisma';

export async function runManualStationMigration() {
  logger.info('[Migration] Checking for legacy manual mirror sources to migrate...');

  try {
    // 1. Find all MirrorSources with adapterType === 'MANUAL'
    const legacySources = await prisma.mirrorSource.findMany({
      where: {
        adapterType: 'MANUAL',
      },
      include: {
        categories: {
          include: {
            resources: {
              include: {
                comments: true,
                likes: true,
              },
            },
          },
        },
        // Also fetch resources that are not categorised (categoryId = null)
        resources: {
          where: {
            categoryId: null,
          },
          include: {
            comments: true,
            likes: true,
          },
        },
      },
    });

    if (legacySources.length === 0) {
      logger.info('[Migration] No legacy manual mirror sources found. Migration skipped.');
      return;
    }

    logger.info(
      `[Migration] Found ${legacySources.length} legacy manual mirror source(s) to migrate.`,
    );

    for (const source of legacySources) {
      logger.info(
        `[Migration] Migrating manual source: "${source.displayName}" (${source.name})...`,
      );

      // Check if already migrated to avoid unique constraint violations
      const existingStation = await prisma.manualStation.findUnique({
        where: { name: source.name },
      });

      if (existingStation) {
        logger.info(
          `[Migration] ManualStation "${source.name}" already exists in the new schema. Cleaning up legacy source...`,
        );
        await prisma.mirrorSource.delete({ where: { id: source.id } });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        // Create ManualStation
        const station = await tx.manualStation.create({
          data: {
            id: source.id,
            name: source.name,
            displayName: source.displayName,
            status: source.status,
            totalResources: source.totalResources,
            minPlanPriority: source.minPlanPriority,
            iconUrl: source.iconUrl,
            description: source.description,
            createdAt: source.createdAt,
            updatedAt: source.updatedAt,
          },
        });

        // Migrate Categories
        for (const cat of source.categories) {
          await tx.manualCategory.create({
            data: {
              id: cat.id,
              stationId: station.id,
              name: cat.name,
              slug: cat.slug,
              order: cat.order,
              resourceCount: cat.resourceCount,
              createdAt: cat.createdAt,
              updatedAt: cat.updatedAt,
            },
          });

          // Migrate Resources in this Category
          for (const res of cat.resources) {
            await tx.manualResource.create({
              data: {
                id: res.id,
                stationId: station.id,
                categoryId: cat.id,
                title: res.title,
                description: res.description,
                thumbnailUrl: res.thumbnailUrl,
                contentUrl: res.contentUrl,
                tags: res.tags,
                contentHtml: res.contentHtml,
                resourceType: res.resourceType,
                viewCount: res.viewCount,
                createdAt: res.createdAt,
                updatedAt: res.updatedAt,
              },
            });

            // Migrate Comments
            for (const comment of res.comments) {
              await tx.manualResourceComment.create({
                data: {
                  id: comment.id,
                  resourceId: res.id,
                  userId: comment.userId,
                  content: comment.content,
                  createdAt: comment.createdAt,
                },
              });
            }

            // Migrate Likes
            for (const like of res.likes) {
              await tx.manualResourceLike.create({
                data: {
                  id: like.id,
                  resourceId: res.id,
                  userId: like.userId,
                  createdAt: like.createdAt,
                },
              });
            }
          }
        }

        // Migrate Uncategorized Resources
        for (const res of source.resources) {
          await tx.manualResource.create({
            data: {
              id: res.id,
              stationId: station.id,
              categoryId: null,
              title: res.title,
              description: res.description,
              thumbnailUrl: res.thumbnailUrl,
              contentUrl: res.contentUrl,
              tags: res.tags,
              contentHtml: res.contentHtml,
              resourceType: res.resourceType,
              viewCount: res.viewCount,
              createdAt: res.createdAt,
              updatedAt: res.updatedAt,
            },
          });

          // Migrate Comments
          for (const comment of res.comments) {
            await tx.manualResourceComment.create({
              data: {
                id: comment.id,
                resourceId: res.id,
                userId: comment.userId,
                content: comment.content,
                createdAt: comment.createdAt,
              },
            });
          }

          // Migrate Likes
          for (const like of res.likes) {
            await tx.manualResourceLike.create({
              data: {
                id: like.id,
                resourceId: res.id,
                userId: like.userId,
                createdAt: like.createdAt,
              },
            });
          }
        }

        // Delete the legacy MirrorSource (this cascades and deletes categories, resources, comments, etc.)
        await tx.mirrorSource.delete({
          where: {
            id: source.id,
          },
        });
      });

      logger.info(
        `[Migration] Successfully migrated legacy manual source "${source.displayName}" to ManualStation!`,
      );
    }

    logger.info('[Migration] All manual station migrations completed successfully.');
  } catch (error) {
    logger.error('[Migration] Failed to run manual station database migration:', error);
  }
}

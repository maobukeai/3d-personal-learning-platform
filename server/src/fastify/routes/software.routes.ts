import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as softwareController from '../../controllers/software.controller';
import { fastifyAuthenticate } from '../auth/fastify-auth';
import { fastifyUpload } from '../middlewares/fastify-upload.middleware';

const idParamsSchema = z.object({
  id: z.string().min(1, 'Id is required'),
});

const shareIdParamsSchema = z.object({
  shareId: z.string().min(1, 'Share id is required'),
});

export const registerSoftwareRoutes = (app: FastifyInstance): void => {
  const auth = { preHandler: [fastifyAuthenticate] };

  const uploadFields = [
    { name: 'software_file', maxCount: 1 },
    { name: 'software_preview', maxCount: 1 },
  ];
  const uploadSingleField = [{ name: 'software_file', maxCount: 1 }];

  const uploadAuth = {
    preHandler: [fastifyAuthenticate, fastifyUpload(uploadFields)],
  };
  const uploadVersionAuth = {
    preHandler: [fastifyAuthenticate, fastifyUpload(uploadSingleField)],
  };

  // Public / Share routes
  app.get(
    '/softwares/share/:shareId',
    { schema: { params: shareIdParamsSchema } },
    softwareController.getPublicSharedSoftware,
  );

  // Authenticated browse & details
  app.get('/softwares', { ...auth }, softwareController.listSoftwares);
  app.get('/softwares/insights', { ...auth }, softwareController.getSoftwareInsights);
  app.get('/softwares/favorites', { ...auth }, softwareController.getMyFavoriteSoftwares);
  app.post(
    '/softwares/favorites/categories',
    { ...auth },
    softwareController.createFavoriteCategory,
  );
  app.put(
    '/softwares/favorites/categories',
    { ...auth },
    softwareController.updateFavoriteCategory,
  );
  app.delete(
    '/softwares/favorites/categories/:categoryName',
    { ...auth },
    softwareController.deleteFavoriteCategory,
  );
  app.get('/softwares/my', { ...auth }, softwareController.getMySoftwares);
  app.get(
    '/softwares/:id',
    { ...auth, schema: { params: idParamsSchema } },
    softwareController.getSoftwareById,
  );
  app.get(
    '/softwares/:id/package-files',
    { ...auth, schema: { params: idParamsSchema } },
    softwareController.getSoftwarePackageFiles,
  );

  // Authenticated write/uploads
  app.post('/softwares/upload', { ...uploadAuth }, softwareController.uploadSoftware);
  app.put(
    '/softwares/:id',
    { ...uploadAuth, schema: { params: idParamsSchema } },
    softwareController.updateSoftware,
  );
  app.delete(
    '/softwares/:id',
    { ...auth, schema: { params: idParamsSchema } },
    softwareController.deleteSoftware,
  );
  app.post('/softwares/bulk-delete', { ...auth }, softwareController.bulkDeleteSoftwares);
  app.post('/softwares/bulk/favorite', { ...auth }, softwareController.bulkFavoriteSoftwares);
  app.post(
    '/softwares/:id/download',
    { ...auth, schema: { params: idParamsSchema } },
    softwareController.downloadSoftware,
  );
  app.post(
    '/softwares/:id/favorite',
    { ...auth, schema: { params: idParamsSchema } },
    softwareController.toggleSoftwareFavorite,
  );

  // Versions routes
  app.get(
    '/softwares/:id/versions',
    { ...auth, schema: { params: idParamsSchema } },
    softwareController.listSoftwareVersions,
  );
  app.post(
    '/softwares/:id/versions',
    { ...uploadVersionAuth, schema: { params: idParamsSchema } },
    softwareController.createSoftwareVersion,
  );
  app.put(
    '/softwares/:id/versions/:versionId',
    { ...auth, schema: { params: z.object({ id: z.string(), versionId: z.string() }) } },
    softwareController.updateSoftwareVersion,
  );
  app.delete(
    '/softwares/:id/versions/:versionId',
    { ...auth, schema: { params: z.object({ id: z.string(), versionId: z.string() }) } },
    softwareController.deleteSoftwareVersion,
  );
  app.post(
    '/softwares/:id/versions/:versionId/set-active',
    { ...auth, schema: { params: z.object({ id: z.string(), versionId: z.string() }) } },
    softwareController.setActiveSoftwareVersion,
  );

  // Comments endpoints
  app.get(
    '/softwares/:id/comments',
    { ...auth, schema: { params: idParamsSchema } },
    softwareController.getSoftwareComments,
  );
  app.post(
    '/softwares/:id/comments',
    { ...auth, schema: { params: idParamsSchema } },
    softwareController.createSoftwareComment,
  );
  app.delete(
    '/softwares/comments/:commentId',
    { ...auth },
    softwareController.deleteSoftwareComment,
  );

  // Sharing endpoints
  app.get(
    '/softwares/:id/share',
    { ...auth, schema: { params: idParamsSchema } },
    softwareController.getSoftwareShare,
  );
  app.post(
    '/softwares/:id/share',
    { ...auth, schema: { params: idParamsSchema } },
    softwareController.createOrUpdateSoftwareShare,
  );
  app.delete(
    '/softwares/:id/share',
    { ...auth, schema: { params: idParamsSchema } },
    softwareController.cancelSoftwareShare,
  );
};

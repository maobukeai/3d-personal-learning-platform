import { Router } from 'express';
import * as softwareController from '../controllers/software.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';

const router = Router();

router.get('/share/:shareId', softwareController.getPublicSharedSoftware);

// Authenticated routes
router.use(authenticate);
router.get('/', softwareController.listSoftwares);
router.get('/insights', softwareController.getSoftwareInsights);
router.get('/favorites', softwareController.getMyFavoriteSoftwares);
router.post('/favorites/categories', softwareController.createFavoriteCategory);
router.put('/favorites/categories', softwareController.updateFavoriteCategory);
router.delete('/favorites/categories/:categoryName', softwareController.deleteFavoriteCategory);
router.get('/my', softwareController.getMySoftwares);
router.get('/:id', softwareController.getSoftwareById);
router.get('/:id/package-files', softwareController.getSoftwarePackageFiles);
router.post(
  '/upload',
  upload.fields([
    { name: 'software_file', maxCount: 1 },
    { name: 'software_preview', maxCount: 1 },
  ]),
  validateFileContent,
  softwareController.uploadSoftware,
);
router.put(
  '/:id',
  upload.fields([
    { name: 'software_file', maxCount: 1 },
    { name: 'software_preview', maxCount: 1 },
  ]),
  validateFileContent,
  softwareController.updateSoftware,
);
router.delete('/:id', softwareController.deleteSoftware);
router.post('/bulk-delete', softwareController.bulkDeleteSoftwares);
router.post('/bulk/favorite', softwareController.bulkFavoriteSoftwares);
router.post('/:id/download', softwareController.downloadSoftware);
router.post('/:id/favorite', softwareController.toggleSoftwareFavorite);

// Versions routes
router.get('/:id/versions', softwareController.listSoftwareVersions);
router.post(
  '/:id/versions',
  upload.fields([{ name: 'software_file', maxCount: 1 }]),
  validateFileContent,
  softwareController.createSoftwareVersion,
);
router.put('/:id/versions/:versionId', softwareController.updateSoftwareVersion);
router.delete('/:id/versions/:versionId', softwareController.deleteSoftwareVersion);
router.post('/:id/versions/:versionId/set-active', softwareController.setActiveSoftwareVersion);

// Comments endpoints
router.get('/:id/comments', softwareController.getSoftwareComments);
router.post('/:id/comments', softwareController.createSoftwareComment);
router.delete('/comments/:commentId', softwareController.deleteSoftwareComment);

// Sharing endpoints
router.get('/:id/share', softwareController.getSoftwareShare);
router.post('/:id/share', softwareController.createOrUpdateSoftwareShare);
router.delete('/:id/share', softwareController.cancelSoftwareShare);

export default router;

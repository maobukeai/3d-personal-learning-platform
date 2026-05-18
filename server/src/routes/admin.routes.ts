import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

// Apply auth and admin middleware to all routes in this router
router.use(authenticate, isAdmin);

router.get('/stats', adminController.getAdminStats);
router.get('/settings', adminController.getSettings);
router.post('/settings', adminController.updateSettings);
router.post('/settings/upload-logo', upload.single('logo'), adminController.uploadBrandingLogo);
router.post(
  '/settings/upload-favicon',
  upload.single('favicon'),
  adminController.uploadBrandingFavicon,
);
router.post('/settings/test-smtp', adminController.testSmtp);
router.get('/audit-logs', adminController.getAuditLogs);

router.get('/users', adminController.getUsers);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.post('/users/:id/reset-password', adminController.resetUserPassword);
router.put('/users/:id/role', adminController.updateUserRole);
router.delete('/users/:id', adminController.deleteUser);

router.get('/feedback', adminController.getAllFeedback);
router.put('/feedback/:id/status', adminController.updateFeedbackStatus);
router.delete('/feedback/:id', adminController.deleteFeedback);

// Roadmap management
router.get('/roadmaps', adminController.getAllRoadmaps);
router.post('/roadmaps', adminController.createRoadmap);
router.put('/roadmaps/:id', adminController.updateRoadmap);
router.delete('/roadmaps/:id', adminController.deleteRoadmap);
router.post('/roadmaps/steps', adminController.createRoadmapStep);
router.put('/roadmaps/steps/:id', adminController.updateRoadmapStep);
router.delete('/roadmaps/steps/:id', adminController.deleteRoadmapStep);

// Course category management
router.get('/course-categories', adminController.getAllCourseCategories);
router.post('/course-categories', adminController.createCourseCategory);
router.put('/course-categories/:id', adminController.updateCourseCategory);
router.delete('/course-categories/:id', adminController.deleteCourseCategory);

// Course management
router.get('/courses', adminController.getAllCourses);
router.post('/courses', adminController.createCourse);
router.post('/courses/batch', adminController.createCourseWithLessons);
router.post('/courses/parse-external', adminController.parseExternalLink);
router.put('/courses/:id', adminController.updateCourse);
router.delete('/courses/:id', adminController.deleteCourse);
router.post('/courses/lessons', adminController.createLesson);
router.put('/courses/lessons/:id', adminController.updateLesson);
router.delete('/courses/lessons/:id', adminController.deleteLesson);

// Team management
router.get('/teams', adminController.getAllTeams);
router.post('/teams', adminController.createTeam);
router.put('/teams/:id', adminController.updateTeam);
router.delete('/teams/:id', adminController.deleteTeam);
router.put('/teams/:teamId/members/:userId/role', adminController.updateTeamMemberRole);
router.delete('/teams/:teamId/members/:userId', adminController.removeTeamMember);

// Material audit
import * as categoryController from '../controllers/category.controller';
router.get('/asset-categories', categoryController.getAllCategories);
router.post('/asset-categories', categoryController.adminCreateCategory);
router.put('/asset-categories/:id', categoryController.adminUpdateCategory);
router.delete('/asset-categories/:id', categoryController.adminDeleteCategory);

router.get('/materials', adminController.getAllMaterialsForAdmin);
router.put('/materials/batch-status', adminController.batchUpdateMaterialStatus);
router.put('/materials/:id/status', adminController.updateMaterialStatus);
router.put('/materials/:id', adminController.adminUpdateMaterial);
router.delete('/materials/:id', adminController.adminDeleteMaterial);

// Showcase audit
router.get('/showcases', adminController.getAllShowcasesForAdmin);
router.put('/showcases/batch-status', adminController.batchUpdateShowcaseStatus);
router.put('/showcases/:id/status', adminController.updateShowcaseStatus);
router.delete('/showcases/:id', adminController.adminDeleteShowcase);

// Asset management
import * as assetController from '../controllers/asset.controller';
router.get('/assets', assetController.getAllAssetsForAdmin);
router.put('/assets/batch-status', assetController.batchUpdateAssetStatus);
router.put('/assets/:id/status', assetController.updateAssetStatus);
router.put('/assets/:id', assetController.adminUpdateAsset);
router.delete('/assets/:id', assetController.adminDeleteAsset);

router.get('/broadcasts', adminController.getBroadcasts);
router.post('/broadcast', adminController.sendBroadcast);
router.delete('/broadcasts/:id', adminController.deleteBroadcast);

router.get('/subscription-plans', adminController.getAllSubscriptionPlans);
router.post('/subscription-plans', adminController.createSubscriptionPlan);
router.put('/subscription-plans/:id', adminController.updateSubscriptionPlan);
router.delete('/subscription-plans/:id', adminController.deleteSubscriptionPlan);
router.get('/subscriptions', adminController.getAllSubscriptions);
router.post('/subscriptions', adminController.createSubscription);
router.put('/subscriptions/:id', adminController.updateSubscription);
router.delete('/subscriptions/:id', adminController.deleteSubscription);
router.get('/transactions', adminController.getAllTransactions);

export default router;

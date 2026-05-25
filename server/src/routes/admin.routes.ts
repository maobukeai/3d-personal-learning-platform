import { Router } from 'express';
import * as dashboardController from '../controllers/admin/dashboard.controller';
import * as settingsController from '../controllers/admin/settings.controller';
import * as userController from '../controllers/admin/user.controller';
import * as courseController from '../controllers/admin/course.controller';
import * as contentController from '../controllers/admin/content.controller';
import * as teamController from '../controllers/admin/team.controller';
import * as subscriptionController from '../controllers/admin/subscription.controller';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';

const router = Router();

// Apply auth and admin middleware to all routes in this router
router.use(authenticate, isAdmin);

// Dashboard / Stats / Logs / Broadcasts
router.get('/stats', dashboardController.getAdminStats);
router.get('/audit-logs', dashboardController.getAuditLogs);
router.get('/broadcasts', dashboardController.getBroadcasts);
router.post('/broadcast', dashboardController.sendBroadcast);
router.delete('/broadcasts/:id', dashboardController.deleteBroadcast);

// Settings
router.get('/settings', settingsController.getSettings);
router.post('/settings', settingsController.updateSettings);
router.post(
  '/settings/upload-logo',
  upload.single('logo'),
  validateFileContent,
  settingsController.uploadBrandingLogo,
);
router.post(
  '/settings/upload-favicon',
  upload.single('favicon'),
  validateFileContent,
  settingsController.uploadBrandingFavicon,
);
router.post('/settings/test-smtp', settingsController.testSmtp);
router.post('/settings/test-ai', settingsController.testAi);
router.post('/settings/cleanup-storage', settingsController.cleanupStorage);

// Users
router.get('/users', userController.getUsers);
router.post('/users', userController.createUser);
router.put('/users/:id', userController.updateUser);
router.post('/users/:id/reset-password', userController.resetUserPassword);
router.put('/users/:id/role', userController.updateUserRole);
router.delete('/users/:id', userController.deleteUser);

// Feedback
router.get('/feedback', contentController.getAllFeedback);
router.put('/feedback/:id/status', contentController.updateFeedbackStatus);
router.delete('/feedback/:id', contentController.deleteFeedback);

// Roadmap management
router.get('/roadmaps', courseController.getAllRoadmaps);
router.post('/roadmaps', courseController.createRoadmap);
router.put('/roadmaps/:id', courseController.updateRoadmap);
router.delete('/roadmaps/:id', courseController.deleteRoadmap);
router.post('/roadmaps/steps', courseController.createRoadmapStep);
router.put('/roadmaps/steps/:id', courseController.updateRoadmapStep);
router.delete('/roadmaps/steps/:id', courseController.deleteRoadmapStep);

// Course category management
router.get('/course-categories', courseController.getAllCourseCategories);
router.post('/course-categories', courseController.createCourseCategory);
router.put('/course-categories/:id', courseController.updateCourseCategory);
router.delete('/course-categories/:id', courseController.deleteCourseCategory);

// Course management
router.get('/courses', courseController.getAllCourses);
router.post('/courses', courseController.createCourse);
router.post('/courses/batch', courseController.createCourseWithLessons);
router.post('/courses/parse-external', courseController.parseExternalLink);
router.put('/courses/:id', courseController.updateCourse);
router.delete('/courses/:id', courseController.deleteCourse);
router.post('/courses/lessons', courseController.createLesson);
router.put('/courses/lessons/:id', courseController.updateLesson);
router.delete('/courses/lessons/:id', courseController.deleteLesson);

// Team management
router.get('/teams', teamController.getAllTeams);
router.post('/teams', teamController.createTeam);
router.put('/teams/:id', teamController.updateTeam);
router.delete('/teams/:id', teamController.deleteTeam);
router.put('/teams/:teamId/members/:userId/role', teamController.updateTeamMemberRole);
router.delete('/teams/:teamId/members/:userId', teamController.removeTeamMember);

// Material audit
import * as categoryController from '../controllers/category.controller';
router.get('/asset-categories', categoryController.getAllCategories);
router.post('/asset-categories', categoryController.adminCreateCategory);
router.put('/asset-categories/:id', categoryController.adminUpdateCategory);
router.delete('/asset-categories/:id', categoryController.adminDeleteCategory);

router.get('/materials', contentController.getAllMaterialsForAdmin);
router.put('/materials/batch-status', contentController.batchUpdateMaterialStatus);
router.put('/materials/:id/status', contentController.updateMaterialStatus);
router.put('/materials/:id', contentController.adminUpdateMaterial);
router.delete('/materials/:id', contentController.adminDeleteMaterial);

// Showcase audit
router.get('/showcases', contentController.getAllShowcasesForAdmin);
router.put('/showcases/batch-status', contentController.batchUpdateShowcaseStatus);
router.put('/showcases/:id/status', contentController.updateShowcaseStatus);
router.delete('/showcases/:id', contentController.adminDeleteShowcase);

// Asset management
import * as assetController from '../controllers/asset.controller';
router.get('/assets', assetController.getAllAssetsForAdmin);
router.put('/assets/batch-status', assetController.batchUpdateAssetStatus);
router.put('/assets/:id/status', assetController.updateAssetStatus);
router.put('/assets/:id', assetController.adminUpdateAsset);
router.delete('/assets/:id', assetController.adminDeleteAsset);

// Subscription management
router.get('/subscription-plans', subscriptionController.getAllSubscriptionPlans);
router.post('/subscription-plans', subscriptionController.createSubscriptionPlan);
router.put('/subscription-plans/:id', subscriptionController.updateSubscriptionPlan);
router.delete('/subscription-plans/:id', subscriptionController.deleteSubscriptionPlan);
router.get('/subscriptions', subscriptionController.getAllSubscriptions);
router.post('/subscriptions', subscriptionController.createSubscription);
router.put('/subscriptions/:id', subscriptionController.updateSubscription);
router.delete('/subscriptions/:id', subscriptionController.deleteSubscription);
router.get('/transactions', subscriptionController.getAllTransactions);

// Activation codes management
import * as activationCodeController from '../controllers/activationCode.controller';
router.get('/activation-codes', activationCodeController.getAllActivationCodes);
router.post('/activation-codes', activationCodeController.createActivationCode);
router.delete('/activation-codes/:id', activationCodeController.deleteActivationCode);

export default router;

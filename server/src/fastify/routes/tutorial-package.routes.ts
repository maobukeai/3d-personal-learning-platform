import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fastifyAuthenticate } from '../auth/fastify-auth';
import { AppError } from '../../utils/error';
import * as controller from '../../controllers/tutorial-package.controller';
import * as imageController from '../../controllers/tutorial-package-image.controller';

const adminOnly = async (request: FastifyRequest, reply: FastifyReply) => {
  await fastifyAuthenticate(request, reply);
  if (request.user?.role !== 'ADMIN') {
    throw new AppError('Forbidden: Admin access required', 403, 'ADMIN_REQUIRED');
  }
};

export function registerTutorialPackageRoutes(app: FastifyInstance): void {
  const auth = { preHandler: [adminOnly] };
  const writeAuth = {
    preHandler: [adminOnly],
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  };
  const imageUploadAuth = {
    preHandler: [adminOnly],
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    bodyLimit: 10 * 1024 * 1024,
  };

  app.get('/courses/:courseId/tutorial-packages', auth, controller.listPackages);
  app.post(
    '/courses/:courseId/tutorial-packages',
    { preHandler: [adminOnly], config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    controller.importPackages,
  );
  app.patch('/courses/tutorial-lessons/:id', writeAuth, controller.updateTutorialLesson);
  app.delete('/courses/tutorial-lessons/:id', writeAuth, controller.deleteTutorialLesson);
  app.post('/courses/tutorial-sections', writeAuth, controller.createSection);
  app.patch('/courses/tutorial-sections/:id', writeAuth, controller.updateSection);
  app.delete('/courses/tutorial-sections/:id', writeAuth, controller.deleteSection);
  app.post('/courses/tutorial-steps', writeAuth, controller.createStep);
  app.patch('/courses/tutorial-steps/:id', writeAuth, controller.updateStep);
  app.delete('/courses/tutorial-steps/:id', writeAuth, controller.deleteStep);
  app.post('/courses/tutorial-steps/:id/image', imageUploadAuth, imageController.replaceStepImage);
  app.delete('/courses/tutorial-steps/:id/image', writeAuth, imageController.removeStepImage);
}

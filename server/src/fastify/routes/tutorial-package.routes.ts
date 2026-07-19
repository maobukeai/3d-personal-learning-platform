import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fastifyAuthenticate } from '../auth/fastify-auth';
import { AppError } from '../../utils/error';
import * as controller from '../../controllers/tutorial-package.controller';

const adminOnly = async (request: FastifyRequest, reply: FastifyReply) => {
  await fastifyAuthenticate(request, reply);
  if (request.user?.role !== 'ADMIN') {
    throw new AppError('Forbidden: Admin access required', 403, 'ADMIN_REQUIRED');
  }
};

export function registerTutorialPackageRoutes(app: FastifyInstance): void {
  const auth = { preHandler: [adminOnly] };
  app.get('/courses/:courseId/tutorial-packages', auth, controller.listPackages);
  app.post(
    '/courses/:courseId/tutorial-packages',
    { ...auth, config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    controller.importPackages,
  );
  app.patch('/courses/tutorial-lessons/:id', auth, controller.updateTutorialLesson);
  app.delete('/courses/tutorial-lessons/:id', auth, controller.deleteTutorialLesson);
  app.post('/courses/tutorial-sections', auth, controller.createSection);
  app.patch('/courses/tutorial-sections/:id', auth, controller.updateSection);
  app.delete('/courses/tutorial-sections/:id', auth, controller.deleteSection);
  app.post('/courses/tutorial-steps', auth, controller.createStep);
  app.patch('/courses/tutorial-steps/:id', auth, controller.updateStep);
  app.delete('/courses/tutorial-steps/:id', auth, controller.deleteStep);
  app.post('/courses/tutorial-steps/:id/image', auth, controller.replaceStepImage);
  app.delete('/courses/tutorial-steps/:id/image', auth, controller.removeStepImage);
}

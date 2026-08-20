import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import path from 'path';
import fs from 'fs';
import { createReadStream } from 'fs';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.mp4': 'video/mp4',
};

export const registerStaticUploadsRoutes = (app: FastifyInstance): void => {
  app.get('/uploads/*', async (request: FastifyRequest, reply: FastifyReply) => {
    const rawPath = (request.params as { '*': string })['*'] || '';
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    const safePath = path.resolve(uploadsDir, rawPath);

    if (!safePath.startsWith(uploadsDir)) {
      return reply.status(403).send({ error: 'Access Denied' });
    }

    if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
      return reply.status(404).send({ error: 'File Not Found' });
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    reply.header('Content-Type', contentType);
    reply.header('Cache-Control', 'public, max-age=86400');
    // SVG uploads are served same-origin; neuter scripts inside them so an
    // uploaded SVG opened directly cannot execute JS in the site's origin.
    if (contentType === 'image/svg+xml') {
      reply.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
      reply.header('X-Content-Type-Options', 'nosniff');
    }
    return reply.send(createReadStream(safePath));
  });
};

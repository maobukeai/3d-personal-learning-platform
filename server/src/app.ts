import type { IncomingMessage, ServerResponse } from 'http';
import { fapp, startFastify } from './fastify/app';
import { logger } from './utils/logger';

// Start booting fastify automatically when imported in tests
const bootPromise = startFastify().catch((err: unknown) => {
  const errMsg = err instanceof Error ? err.message : String(err);
  logger.error('[Jest Test Proxy] Fastify boot failed:', errMsg);
  throw err;
});

// Export a request handler function for Supertest compatibility
const requestHandler = (req: IncomingMessage, res: ServerResponse) => {
  bootPromise
    .then(() => {
      fapp.server.emit('request', req, res);
    })
    .catch((err) => {
      logger.error('[Jest Test Proxy] Forwarding request failed:', err);
      res.statusCode = 500;
      res.end('Fastify boot failed');
    });
};

// Also attach address method if supertest expects it on the object
(
  requestHandler as ((req: IncomingMessage, res: ServerResponse) => void) & {
    address?: () => { port: number; family: string; address: string };
  }
).address = () => ({ port: 0, family: 'IPv4', address: '127.0.0.1' });

export default requestHandler;
export { requestHandler as app };

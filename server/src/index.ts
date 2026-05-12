import http from 'http';
import app from './app';
import { config } from './config/env';
import { initSocket } from './services/socket.service';

const port = config.PORT;

const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

server.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
  console.log(`Environment: ${config.NODE_ENV}`);
});

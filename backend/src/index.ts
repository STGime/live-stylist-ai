import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import pinoHttp from 'pino-http';
import { logger } from './utils/logger';
import { loadEnv } from './config/env';
import { initFirebase } from './config/firebase';
import { generalRateLimiter } from './middleware/rate-limiter.middleware';
import { errorHandler } from './middleware/error-handler.middleware';
import healthRoutes from './routes/health.routes';
import userRoutes from './routes/user.routes';
import sessionRoutes from './routes/session.routes';
import { setupWebSocket } from './ws/session-control.ws';
import { shutdownAllSessions } from './services/session-manager.service';

// Load and validate env vars (fail-fast)
const env = loadEnv();

// Initialize Firebase
initFirebase();

// Express app
const app = express();
const server = createServer(app);

// WebSocket server on /ws/session path
const wss = new WebSocketServer({
  server,
  path: '/ws/session',
});
setupWebSocket(wss);

// Middleware
app.use(express.json());
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));
app.use(generalRateLimiter);

// Trust proxy (Cloud Run sits behind a load balancer)
app.set('trust proxy', 1);

// Routes
app.use(healthRoutes);
app.use(userRoutes);
app.use(sessionRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'LiveStylist AI backend started');
});

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received');

  // End all active sessions
  await shutdownAllSessions();

  // Close WebSocket server
  wss.close(() => {
    logger.info('WebSocket server closed');
  });

  // Close HTTP server
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, server };

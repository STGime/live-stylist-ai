import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { pinoHttp } from 'pino-http';
import { logger } from './utils/logger.js';
import { loadEnv } from './config/env.js';
import { pingEurobase } from './config/eurobase.js';
import { generalRateLimiter } from './middleware/rate-limiter.middleware.js';
import { errorHandler } from './middleware/error-handler.middleware.js';
import healthRoutes from './routes/health.routes.js';
import userRoutes from './routes/user.routes.js';
import sessionRoutes from './routes/session.routes.js';
import followRoutes from './routes/follow.routes.js';
import blocksRoutes from './routes/blocks.routes.js';
import feedRoutes from './routes/feed.routes.js';
import internalRoutes from './routes/internal.routes.js';
import { setupWebSocket } from './ws/session-control.ws.js';
import { setupAdkWebSocket, shutdownAdkSessions } from './ws/adk-session.ws.js';
import { shutdownAllSessions } from './services/session-manager.service.js';

// Load and validate env vars (fail-fast)
const env = loadEnv();

// Verify Eurobase connectivity (non-blocking — log a warning if unreachable so
// boot can still complete and routes return 503 from /ready until it recovers).
pingEurobase().catch((err) => {
  logger.warn({ err: err instanceof Error ? err.message : err }, 'Eurobase ping failed at boot');
});

// Express app
const app = express();
const server = createServer(app);

// WebSocket servers (noServer mode to avoid upgrade conflicts)
const wss = new WebSocketServer({ noServer: true });
setupWebSocket(wss);

const adkWss = new WebSocketServer({ noServer: true });
setupAdkWebSocket(adkWss);

// Route upgrade requests to the correct WebSocket server
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;

  if (pathname === '/ws/session') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/adk') {
    adkWss.handleUpgrade(request, socket, head, (ws) => {
      adkWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Middleware
app.use(express.json());
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));
app.use(generalRateLimiter);

// Trust proxy (Cloud Run sits behind a load balancer)
app.set('trust proxy', 1);

// Disable auto-ETag. iOS NSURLSession caches GET responses and sends
// If-None-Match on subsequent calls; Express then returns 304 with no
// body. Our apiRequest treats non-2xx as an error, so the pending-follows
// list (and any other GET) silently appears empty after the first fetch.
// This is a JSON API with frequently-changing data — ETags add no value.
app.set('etag', false);

// Routes. Order matters: routers that don't use deviceIdMiddleware
// (health, internal) must be mounted FIRST. The middleware is wired via
// `router.use(...)` on each app-user-facing router, but because Express
// runs every mounted router's middleware in order, that `router.use(...)`
// applies to any subsequent router as well — so internalRoutes mounted
// after userRoutes would 400 with "missing X-Device-ID" before its own
// handler runs. Keeping internal first sidesteps that.
app.use(healthRoutes);
app.use(internalRoutes);
app.use(userRoutes);
app.use(sessionRoutes);
app.use(followRoutes);
app.use(blocksRoutes);
app.use(feedRoutes);

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
  shutdownAdkSessions();
  await shutdownAllSessions();

  // Close WebSocket servers
  adkWss.close(() => {
    logger.info('ADK WebSocket server closed');
  });
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

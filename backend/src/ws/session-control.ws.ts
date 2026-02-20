import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import { logger } from '../utils/logger';
import * as sessionManager from '../services/session-manager.service';
import { ClientEventSchema } from '../types';

export function setupWebSocket(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('session_id');
    const deviceId = url.searchParams.get('device_id');

    if (!sessionId || !deviceId) {
      ws.close(4000, 'Missing session_id or device_id query parameter');
      return;
    }

    // Verify session exists and belongs to device
    const session = sessionManager.getActiveSession(sessionId);
    if (!session) {
      ws.close(4001, 'Session not found or expired');
      return;
    }

    if (session.device_id !== deviceId) {
      ws.close(4003, 'Session does not belong to this device');
      return;
    }

    // Attach WebSocket to session
    const attached = sessionManager.attachWebSocket(sessionId, ws);
    if (!attached) {
      ws.close(4001, 'Failed to attach to session');
      return;
    }

    logger.info({ sessionId, deviceId }, 'WebSocket control channel connected');

    ws.on('message', async (data) => {
      try {
        const raw = JSON.parse(data.toString());
        const event = ClientEventSchema.parse(raw);

        switch (event.type) {
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;

          case 'end_session':
            if (event.session_id !== sessionId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Session ID mismatch' }));
              return;
            }
            await sessionManager.endSession(sessionId, 'manual');
            break;
        }
      } catch (error) {
        logger.warn({ sessionId, error }, 'Invalid WebSocket message');
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', (code, reason) => {
      logger.info({ sessionId, code, reason: reason.toString() }, 'WebSocket control channel closed');
    });

    ws.on('error', (error) => {
      logger.error({ sessionId, error }, 'WebSocket error');
    });
  });
}

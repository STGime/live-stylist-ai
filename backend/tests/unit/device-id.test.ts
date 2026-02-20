import { describe, it, expect, vi } from 'vitest';
import { Request, Response } from 'express';
import { deviceIdMiddleware } from '../../src/middleware/device-id.middleware';

function mockReqRes(deviceId?: string) {
  const req = { headers: {} } as Request;
  if (deviceId) req.headers['x-device-id'] = deviceId;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn();

  return { req, res, next };
}

describe('deviceIdMiddleware', () => {
  it('should set deviceId on request for valid UUID', () => {
    const { req, res, next } = mockReqRes('550e8400-e29b-41d4-a716-446655440000');

    deviceIdMiddleware(req, res, next);

    expect(req.deviceId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(next).toHaveBeenCalled();
  });

  it('should reject missing device ID', () => {
    const { req, res, next } = mockReqRes();

    deviceIdMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject invalid UUID format', () => {
    const { req, res, next } = mockReqRes('not-a-uuid');

    deviceIdMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject empty string', () => {
    const { req, res, next } = mockReqRes('');

    deviceIdMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});

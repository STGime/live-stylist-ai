import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DeviceIdSchema = z.string().regex(UUID_REGEX, 'Invalid device ID format (must be UUID)');

export function deviceIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const deviceId = req.headers['x-device-id'] as string | undefined;

  const result = DeviceIdSchema.safeParse(deviceId);
  if (!result.success) {
    res.status(400).json({
      error: 'invalid_device_id',
      message: 'Missing or invalid X-Device-ID header. Must be a valid UUID.',
    });
    return;
  }

  req.deviceId = result.data;
  next();
}

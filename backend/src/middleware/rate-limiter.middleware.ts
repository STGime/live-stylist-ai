import rateLimit from 'express-rate-limit';

// General API rate limit: 30 requests per minute per device
export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.deviceId || req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'rate_limit_exceeded',
    message: 'Too many requests. Please try again later.',
  },
});

// Session start rate limit: 10 per hour per device
export const sessionStartRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.deviceId || req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'rate_limit_exceeded',
    message: 'Too many session requests. Please try again later.',
  },
});

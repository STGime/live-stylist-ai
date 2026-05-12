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

// Follow-request rate limit: 10 per hour per device. Without this the magic
// ID — which is designed to be shared widely — becomes a harassment vector
// (every request fires a push notification at the target).
export const followRequestRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.deviceId || req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'rate_limit_exceeded',
    message: 'Too many follow requests. Please try again later.',
  },
});

// Follow respond rate limit: looser, since the target initiates. Still useful
// to block tight loops if a buggy client misfires.
export const followRespondRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.deviceId || req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'rate_limit_exceeded',
    message: 'Too many responses. Please try again later.',
  },
});

// Block rate limit: looser than the follow-request limiter on purpose. The
// follow limiter caps the offensive surface — capping blocks with the same
// budget would mean a user under attack from many accounts hits the limit
// while *defending* themselves. Defense should always be at least as
// permissive as offense.
export const blockRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.deviceId || req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'rate_limit_exceeded',
    message: 'Too many block requests. Please try again later.',
  },
});

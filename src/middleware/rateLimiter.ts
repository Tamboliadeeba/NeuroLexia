import rateLimit from 'express-rate-limit';

/**
 * General auth limiter — applied to POST /api/auth/* routes.
 * 20 requests per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/**
 * PIN override limiter — applied to POST /api/child/verify-override-pin.
 * 5 attempts per 10 minutes per IP.
 * (Phase 4 will tighten this to per childId.)
 */
export const pinOverrideLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many PIN attempts. Please wait before trying again.' },
});

/**
 * Report generation limiter — applied to POST /api/reports/generate.
 * 5 requests per 24 hours per IP.
 * (Phase 6 will refine this to per child per day using a DB counter.)
 */
export const reportLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Report generation limit reached for today.' },
});

/**
 * WebAuthn limiter — applied to biometric registration and authentication.
 * 10 requests per 5 minutes per IP.
 */
export const webauthnLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many biometric requests. Please wait before trying again.' },
});

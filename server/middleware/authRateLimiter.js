import rateLimit from 'express-rate-limit';

// ─────────────────────────────────────────────────────────────
// Shared rate-limit error formatter
// ─────────────────────────────────────────────────────────────
function rateLimitHandler(req, res, next, options) {
    res.status(429).json({
        success: false,
        message: options.message,
        retryAfter: Math.ceil(options.windowMs / 60000),
    });
}

// ─────────────────────────────────────────────────────────────
// In development, allow test harness to bypass IP rate limit
// by sending header: X-Test-Bypass: <TEST_BYPASS_SECRET>
// ─────────────────────────────────────────────────────────────
const TEST_BYPASS_SECRET = process.env.TEST_BYPASS_SECRET || 'spendify-dev-test-bypass';

function skipForTests(req) {
    if (process.env.NODE_ENV !== 'development') return false;
    return req.headers['x-test-bypass'] === TEST_BYPASS_SECRET;
}

// ─────────────────────────────────────────────────────────────
// LOGIN  – 5 attempts per 15 minutes per IP
// ─────────────────────────────────────────────────────────────
export const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,        // 15 minutes
    max: 5,
    skipSuccessfulRequests: true,     // successful logins DON'T count against limit
    skip: skipForTests,              // bypass in dev for automated tests
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
    handler: rateLimitHandler,
    keyGenerator: (req) => req.ip,
});

// ─────────────────────────────────────────────────────────────
// REGISTER – 3 accounts per hour per IP
// ─────────────────────────────────────────────────────────────
export const registerRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,        // 1 hour
    max: 3,
    skipSuccessfulRequests: false,    // every registration attempt counts
    skip: skipForTests,              // bypass in dev for automated tests
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many registration attempts from this IP. Please try again after 1 hour.',
    handler: rateLimitHandler,
    keyGenerator: (req) => req.ip,
});

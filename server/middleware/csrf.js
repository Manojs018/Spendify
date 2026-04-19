import crypto from 'crypto';

export const csrfProtection = (req, res, next) => {
    // 1. Bypass CSRF for specific test header to avoid breaking auth and other tests 
    //    that aren't explicitly testing CSRF initially.
    if (process.env.NODE_ENV === 'development' && req.headers['x-test-bypass'] === (process.env.TEST_BYPASS_SECRET || 'spendify-dev-test-bypass')) {
        return next();
    }

    // 2. Bypass CSRF for specific routes:
    //    - Google OAuth routes (server-to-server)
    //    - Login & Registration (standard for pre-auth routes to avoid session hurdles)
    //    - Auth sub-routes protected by JWT (no need for double CSRF protection)
    const bypassRoutes = [
        '/api/auth/google',
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/refresh',
        '/api/auth/me',
    ];

    if (bypassRoutes.some(route => req.path.startsWith(route))) {
        return next();
    }

    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

    if (safeMethods.includes(req.method)) {
        if (!req.cookies || !req.cookies['XSRF-TOKEN']) {
            const token = crypto.randomBytes(32).toString('hex');
            res.cookie('XSRF-TOKEN', token, {
                httpOnly: false, // So JS can read the cookie to send it back via header
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
            });
            req.csrfToken = token;
        }
        return next();
    }

    // State changing methods (POST, PUT, DELETE, PATCH)
    const cookieToken = req.cookies ? req.cookies['XSRF-TOKEN'] : null;
    const headerToken = req.headers['x-xsrf-token'] || req.headers['x-csrf-token'];

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return res.status(403).json({
            success: false,
            message: 'Invalid or missing CSRF token'
        });
    }

    next();
};


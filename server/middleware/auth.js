import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import BlacklistedToken from '../models/BlacklistedToken.js';

// Generate token fingerprint based on request
export const generateFingerprint = (req) => {
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    return crypto.createHash('sha256').update(`${userAgent}-${ip}`).digest('hex');
};

export const protect = async (req, res, next) => {
    let token;

    // Check for token in Authorization header
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized to access this route',
        });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if token is blacklisted
        const isBlacklisted = await BlacklistedToken.exists({ token });
        if (isBlacklisted) {
            return res.status(401).json({
                success: false,
                message: 'Token has been revoked/logged out',
            });
        }

        // Check fingerprint
        const currentFingerprint = generateFingerprint(req);
        if (decoded.fp && decoded.fp !== currentFingerprint) {
            return res.status(401).json({
                success: false,
                message: 'Token fingerprint mismatch',
            });
        }

        // Get user from token
        req.user = await User.findById(decoded.id).select('-password');

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'User not found',
            });
        }

        req.token = token;
        req.decodedToken = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized, token failed',
        });
    }
};

// Generate JWT Token
export const generateToken = (id, req) => {
    const fp = req ? generateFingerprint(req) : undefined;
    const payload = fp ? { id, fp } : { id };

    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE,
    });
};

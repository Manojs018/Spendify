import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import BlacklistedToken from '../models/BlacklistedToken.js';
import { generateToken, generateFingerprint } from '../middleware/auth.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: format minutes-remaining for a locked account
// ─────────────────────────────────────────────────────────────────────────────
function minutesRemaining(lockUntil) {
    const ms = lockUntil - Date.now();
    return Math.ceil(ms / 60000);
}

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
export const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // ── Basic field check ──────────────────────────────────────────────
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, email, and password',
            });
        }

        // ── Check if email exists (prevent enumeration by returning fake success) ──
        const userExists = await User.findOne({ email });
        if (userExists) {
            // Do NOT reveal that the email exists. Pretend it was created.
            return res.status(201).json({
                success: true,
                message: 'Registration successful! Please log in.',
            });
        }

        // ── OWASP password-strength validation ────────────────────────────
        const passwordErrors = [];
        if (!password || password.length < 12)
            passwordErrors.push('Password must be at least 12 characters long');
        if (password && !/[A-Z]/.test(password))
            passwordErrors.push('Password must contain at least one uppercase letter (A-Z)');
        if (password && !/[a-z]/.test(password))
            passwordErrors.push('Password must contain at least one lowercase letter (a-z)');
        if (password && !/[0-9]/.test(password))
            passwordErrors.push('Password must contain at least one number (0-9)');
        if (password && !/[^A-Za-z0-9]/.test(password))
            passwordErrors.push('Password must contain at least one special character (e.g. !@#$%^&*)');

        if (passwordErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: passwordErrors[0],
                errors: passwordErrors,
            });
        }

        // ── Create user (password hashed by pre-save hook) ─────────────────
        const user = await User.create({ name, email, password });

        return res.status(201).json({
            success: true,
            message: 'Registration successful! Please log in.',
        });
    } catch (error) {
        // Mongoose validation errors → expose the first message clearly
        if (error.name === 'ValidationError') {
            const msg = Object.values(error.errors)[0]?.message || 'Validation error';
            return res.status(400).json({ success: false, message: msg });
        }
        return res.status(500).json({ success: false, message: 'Server error during registration' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // ── Basic field check ──────────────────────────────────────────────
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password',
            });
        }

        // ── Find user (include lockout fields + password) ──────────────────
        const user = await User.findOne({ email })
            .select('+password +failedLoginAttempts +lockUntil');

        if (!user) {
            // Generic message – don't leak whether the email exists
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }

        // ── Check account lock ─────────────────────────────────────────────
        if (user.lockUntil && user.lockUntil > Date.now()) {
            const mins = minutesRemaining(user.lockUntil);
            return res.status(423).json({
                success: false,
                message: `Account locked due to too many failed attempts. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`,
                lockUntil: user.lockUntil,
            });
        }

        // ── Verify password ────────────────────────────────────────────────
        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            // Record failed attempt (may lock the account)
            await user.incFailedAttempts();

            // Reload to get updated counts
            const updated = await User.findById(user._id)
                .select('+failedLoginAttempts +lockUntil');

            const attemptsLeft = Math.max(0, 5 - (updated.failedLoginAttempts || 0));

            if (updated.lockUntil && updated.lockUntil > Date.now()) {
                const mins = minutesRemaining(updated.lockUntil);
                return res.status(423).json({
                    success: false,
                    message: `Too many failed attempts. Account locked for ${mins} minute${mins !== 1 ? 's' : ''}.`,
                    lockUntil: updated.lockUntil,
                });
            }

            return res.status(401).json({
                success: false,
                message: attemptsLeft > 0
                    ? `Invalid email or password. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining before account lock.`
                    : 'Invalid email or password.',
                attemptsLeft,
            });
        }

        // ── Successful login → reset failed attempts ──────────────────────
        await user.resetFailedAttempts();
        const token = generateToken(user._id, req);

        // Generate Refresh Token
        const refreshTokenStr = crypto.randomBytes(40).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        await RefreshToken.create({
            user: user._id,
            token: refreshTokenStr,
            expiresAt,
            fingerprint: generateFingerprint(req)
        });

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    balance: user.balance,
                },
                token,
                refreshToken: refreshTokenStr,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error during login' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        return res.status(200).json({ success: true, data: user });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get new access token from refresh token
// @route   POST /api/auth/refresh
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
export const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ success: false, message: 'Refresh token is required' });
        }

        const rt = await RefreshToken.findOne({ token: refreshToken }).populate('user');
        if (!rt) {
            return res.status(401).json({ success: false, message: 'Invalid refresh token' });
        }

        if (rt.revokedAt != null) {
            return res.status(401).json({ success: false, message: 'Refresh token has been revoked' });
        }

        if (new Date() > rt.expiresAt) {
            return res.status(401).json({ success: false, message: 'Refresh token has expired' });
        }

        // Optional: check fingerprint of refresh token
        const currentFingerprint = generateFingerprint(req);
        if (rt.fingerprint !== currentFingerprint) {
            return res.status(401).json({ success: false, message: 'Refresh token fingerprint mismatch' });
        }

        // Rotate refresh token (revoke old, create new)
        rt.revokedAt = new Date();
        await rt.save();

        const newRefreshTokenStr = crypto.randomBytes(40).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await RefreshToken.create({
            user: rt.user._id,
            token: newRefreshTokenStr,
            expiresAt,
            fingerprint: currentFingerprint
        });

        const newToken = generateToken(rt.user._id, req);
        return res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                token: newToken,
                refreshToken: newRefreshTokenStr
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error during token refresh' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Logout user & blacklist token
// @route   POST /api/auth/logout
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const logout = async (req, res) => {
    try {
        // Blacklist current access token
        const token = req.token;
        const decodedToken = req.decodedToken;

        if (token && decodedToken) {
            await BlacklistedToken.create({
                token,
                expiresAt: new Date(decodedToken.exp * 1000)
            });
        }

        // Revoke the refresh token if provided
        const { refreshToken } = req.body;
        if (refreshToken) {
            const rt = await RefreshToken.findOne({ token: refreshToken });
            if (rt) {
                rt.revokedAt = new Date();
                await rt.save();
            }
        }

        return res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error during logout' });
    }
};

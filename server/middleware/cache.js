import { getCache, setCache, clearCacheByPattern } from '../config/redis.js';

/**
 * Middleware to cache API responses
 * @param {string} prefix - Key prefix (e.g., 'transactions', 'analytics')
 * @param {number} ttl - Time to live in seconds
 */
export const cacheMiddleware = (prefix, ttl = 3600) => {
    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Generate cache key based on prefix, userId, and original URL (includes query params)
        const userId = req.user?.id || 'public';
        const key = `cache:${prefix}:${userId}:${req.originalUrl}`;

        try {
            const cachedData = await getCache(key);
            if (cachedData) {
                // Add header to indicate cache hit
                res.setHeader('X-Cache', 'HIT');
                console.log(`🟢 [CACHE HIT] ${key}`);
                return res.status(200).json(cachedData);
            }

            console.log(`🔴 [CACHE MISS] ${key}`);
            // If not in cache, override res.json to store the result before sending
            res.setHeader('X-Cache', 'MISS');
            const originalJson = res.json;
            res.json = function (data) {
                // Only cache successful responses
                if (res.statusCode === 200 && data.success) {
                    setCache(key, data, ttl);
                }
                return originalJson.call(this, data);
            };

            next();
        } catch (error) {
            console.error('Cache Middleware Error:', error);
            next();
        }
    };
};

/**
 * Invalidate all cache keys for a specific user and prefix (or all prefixes if not specified)
 * @param {string} userId - User ID
 * @param {string} prefix - Optional key prefix
 */
export const invalidateUserCache = async (userId, prefix = '*') => {
    try {
        const pattern = `cache:${prefix}:${userId}:*`;
        await clearCacheByPattern(pattern);
    } catch (error) {
        console.error('Cache Invalidation Error:', error);
    }
};

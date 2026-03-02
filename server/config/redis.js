import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let redisClient = null;
let isRedisConnected = false;

// Mock cache for fallback
const memoryCache = new Map();

/**
 * Initialize Redis Client
 */
export const initRedis = async () => {
    try {
        redisClient = createClient({
            url: redisUrl,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 5) {
                        console.error('❌ Redis: Max reconnection attempts reached. Falling back to memory cache.');
                        isRedisConnected = false;
                        return false; // stop retrying
                    }
                    return 1000; // retry after 1s
                }
            }
        });

        redisClient.on('error', (err) => {
            console.error('❌ Redis Error:', err.message);
            isRedisConnected = false;
        });

        redisClient.on('connect', () => {
            console.log('🔗 Redis Connecting...');
        });

        redisClient.on('ready', () => {
            console.log('✅ Redis Connected & Ready');
            isRedisConnected = true;
        });

        await redisClient.connect();
    } catch (error) {
        console.error('❌ Redis Connection Failed:', error.message);
        isRedisConnected = false;
    }
};

/**
 * Get value from cache
 */
export const getCache = async (key) => {
    if (isRedisConnected) {
        try {
            const val = await redisClient.get(key);
            return val ? JSON.parse(val) : null;
        } catch (error) {
            console.error('Redis Get Error:', error);
        }
    }
    return memoryCache.get(key) || null;
};

/**
 * Set value in cache
 */
export const setCache = async (key, value, ttl = 3600) => {
    const stringValue = JSON.stringify(value);
    if (isRedisConnected) {
        try {
            await redisClient.setEx(key, ttl, stringValue);
        } catch (error) {
            console.error('Redis Set Error:', error);
        }
    }
    // Always update memory cache as backup/secondary
    memoryCache.set(key, value);
    setTimeout(() => memoryCache.delete(key), ttl * 1000);
};

/**
 * Delete value from cache
 */
export const delCache = async (key) => {
    if (isRedisConnected) {
        try {
            await redisClient.del(key);
        } catch (error) {
            console.error('Redis Del Error:', error);
        }
    }
    memoryCache.delete(key);
};

/**
 * Clear cache by pattern
 */
export const clearCacheByPattern = async (pattern) => {
    if (isRedisConnected) {
        try {
            const keys = await redisClient.keys(pattern);
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
        } catch (error) {
            console.error('Redis Clear Pattern Error:', error);
        }
    }
    // For memory cache, we filter keys
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of memoryCache.keys()) {
        if (regex.test(key)) {
            memoryCache.delete(key);
        }
    }
};

export default {
    getCache,
    setCache,
    delCache,
    clearCacheByPattern
};

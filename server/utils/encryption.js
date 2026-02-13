import crypto from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;

/**
 * Encrypt sensitive data using AES-256-CBC
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted text with IV prepended
 */
export const encrypt = (text) => {
    if (!text) return null;

    try {
        // Generate random IV for each encryption
        const iv = crypto.randomBytes(IV_LENGTH);

        // Create cipher
        const key = Buffer.from(ENCRYPTION_KEY, 'hex');
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        // Encrypt the text
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Prepend IV to encrypted data (IV:encrypted)
        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
};

/**
 * Decrypt encrypted data
 * @param {string} encryptedText - Encrypted text with IV prepended
 * @returns {string} - Decrypted plain text
 */
export const decrypt = (encryptedText) => {
    if (!encryptedText) return null;

    try {
        // Split IV and encrypted data
        const parts = encryptedText.split(':');
        if (parts.length !== 2) {
            throw new Error('Invalid encrypted data format');
        }

        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];

        // Create decipher
        const key = Buffer.from(ENCRYPTION_KEY, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

        // Decrypt the text
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt data');
    }
};

/**
 * Get last 4 digits of card number
 * @param {string} cardNumber - Full card number
 * @returns {string} - Last 4 digits
 */
export const getLastFourDigits = (cardNumber) => {
    if (!cardNumber) return '';
    const cleaned = cardNumber.replace(/\s/g, '');
    return cleaned.slice(-4);
};

/**
 * Mask card number for display (shows only last 4 digits)
 * @param {string} lastFour - Last 4 digits
 * @returns {string} - Masked card number
 */
export const maskCardNumber = (lastFour) => {
    return `**** **** **** ${lastFour}`;
};

/**
 * Validate encryption key
 * @returns {boolean} - True if key is valid
 */
export const validateEncryptionKey = () => {
    try {
        if (!ENCRYPTION_KEY) {
            console.error('ENCRYPTION_KEY is not set in environment variables');
            return false;
        }

        const key = Buffer.from(ENCRYPTION_KEY, 'hex');
        if (key.length !== 32) {
            console.error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
            return false;
        }

        return true;
    } catch (error) {
        console.error('Invalid ENCRYPTION_KEY format:', error);
        return false;
    }
};

/**
 * Generate a new encryption key (for initial setup)
 * @returns {string} - New 32-byte encryption key in hex format
 */
export const generateEncryptionKey = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Validate encryption key on module load
if (process.env.NODE_ENV === 'production' && !validateEncryptionKey()) {
    throw new Error('Invalid or missing ENCRYPTION_KEY. Please set a valid 32-byte hex key in environment variables.');
}

export default {
    encrypt,
    decrypt,
    getLastFourDigits,
    maskCardNumber,
    validateEncryptionKey,
    generateEncryptionKey
};

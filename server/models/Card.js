import mongoose from 'mongoose';
import { encrypt, decrypt, getLastFourDigits, maskCardNumber } from '../utils/encryption.js';

const cardSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        // ENCRYPTED card number - NEVER store in plain text
        cardNumberEncrypted: {
            type: String,
            required: [true, 'Card number is required'],
        },
        // Last 4 digits for display purposes only
        lastFourDigits: {
            type: String,
            required: [true, 'Last four digits required'],
            length: 4,
        },
        cardHolderName: {
            type: String,
            required: [true, 'Please provide card holder name'],
            trim: true,
            uppercase: true,
        },
        expiry: {
            type: String,
            required: [true, 'Please provide expiry date'],
            match: [/^(0[1-9]|1[0-2])\/\d{2}$/, 'Expiry must be in MM/YY format'],
        },
        // CVV is NEVER stored - only validated on input
        // This field does NOT exist in the schema
        balance: {
            type: Number,
            default: 0,
            min: [0, 'Balance cannot be negative'],
        },
        cardType: {
            type: String,
            enum: ['visa', 'mastercard', 'amex', 'discover', 'other'],
            default: 'other',
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

// Index for user's cards
cardSchema.index({ userId: 1 });
cardSchema.index({ userId: 1, lastFourDigits: 1 });

// Virtual for masked card number (for display)
cardSchema.virtual('maskedNumber').get(function () {
    return maskCardNumber(this.lastFourDigits);
});

// Virtual to decrypt card number (use sparingly, only when absolutely needed)
cardSchema.virtual('cardNumberDecrypted').get(function () {
    try {
        return decrypt(this.cardNumberEncrypted);
    } catch (error) {
        console.error('Failed to decrypt card number:', error);
        return null;
    }
});

// Method to set card number (encrypts automatically)
cardSchema.methods.setCardNumber = function (cardNumber) {
    // Remove spaces and validate
    const cleaned = cardNumber.replace(/\s/g, '');

    if (!/^\d{16}$/.test(cleaned)) {
        throw new Error('Invalid card number format. Must be 16 digits.');
    }

    // Encrypt the card number
    this.cardNumberEncrypted = encrypt(cleaned);

    // Store last 4 digits for display
    this.lastFourDigits = getLastFourDigits(cleaned);

    // Detect card type
    this.cardType = detectCardType(cleaned);
};

// Method to validate CVV (without storing it)
cardSchema.methods.validateCVV = function (cvv) {
    // CVV validation only - NEVER store
    if (!cvv || !/^\d{3,4}$/.test(cvv)) {
        throw new Error('Invalid CVV. Must be 3 or 4 digits.');
    }

    // For Amex, CVV should be 4 digits
    if (this.cardType === 'amex' && cvv.length !== 4) {
        throw new Error('American Express CVV must be 4 digits.');
    }

    // For other cards, CVV should be 3 digits
    if (this.cardType !== 'amex' && cvv.length !== 3) {
        throw new Error('CVV must be 3 digits.');
    }

    return true;
};

// Method to get decrypted card number (use only when necessary)
cardSchema.methods.getDecryptedCardNumber = function () {
    try {
        return decrypt(this.cardNumberEncrypted);
    } catch (error) {
        console.error('Failed to decrypt card number:', error);
        throw new Error('Unable to retrieve card number');
    }
};

// Pre-save hook to ensure card number is encrypted
cardSchema.pre('save', function (next) {
    // Ensure we never accidentally save plain text card numbers
    if (this.cardNumber && !this.cardNumberEncrypted) {
        try {
            this.setCardNumber(this.cardNumber);
            delete this.cardNumber; // Remove plain text
        } catch (error) {
            return next(error);
        }
    }
    next();
});

// Ensure virtuals are included in JSON but NEVER include encrypted data
cardSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        // Remove sensitive fields from JSON output
        delete ret.cardNumberEncrypted;
        delete ret.__v;
        return ret;
    },
});

cardSchema.set('toObject', {
    virtuals: true,
    transform: function (doc, ret) {
        // Remove sensitive fields from object output
        delete ret.cardNumberEncrypted;
        delete ret.__v;
        return ret;
    },
});

/**
 * Detect card type from card number
 * @param {string} cardNumber - Card number (16 digits)
 * @returns {string} - Card type
 */
function detectCardType(cardNumber) {
    const patterns = {
        visa: /^4/,
        mastercard: /^5[1-5]/,
        amex: /^3[47]/,
        discover: /^6(?:011|5)/,
    };

    for (const [type, pattern] of Object.entries(patterns)) {
        if (pattern.test(cardNumber)) {
            return type;
        }
    }

    return 'other';
}

const Card = mongoose.model('Card', cardSchema);

export default Card;

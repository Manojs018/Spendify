import mongoose from 'mongoose';

const cardSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        cardNumber: {
            type: String,
            required: [true, 'Please provide a card number'],
            trim: true,
            validate: {
                validator: function (v) {
                    // Basic validation for card number format (16 digits)
                    return /^\d{16}$/.test(v.replace(/\s/g, ''));
                },
                message: 'Please provide a valid 16-digit card number',
            },
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
        cvv: {
            type: String,
            required: [true, 'Please provide CVV'],
            match: [/^\d{3,4}$/, 'CVV must be 3 or 4 digits'],
            select: false, // Never return CVV
        },
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

// Virtual for masked card number
cardSchema.virtual('maskedNumber').get(function () {
    const last4 = this.cardNumber.slice(-4);
    return `**** **** **** ${last4}`;
});

// Ensure virtuals are included in JSON
cardSchema.set('toJSON', { virtuals: true });
cardSchema.set('toObject', { virtuals: true });

const Card = mongoose.model('Card', cardSchema);

export default Card;

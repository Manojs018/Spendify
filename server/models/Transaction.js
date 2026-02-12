import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        amount: {
            type: Number,
            required: [true, 'Please provide an amount'],
            min: [0.01, 'Amount must be greater than 0'],
        },
        type: {
            type: String,
            required: [true, 'Please specify transaction type'],
            enum: {
                values: ['income', 'expense'],
                message: 'Type must be either income or expense',
            },
        },
        category: {
            type: String,
            required: [true, 'Please provide a category'],
            trim: true,
        },
        description: {
            type: String,
            trim: true,
            maxlength: [200, 'Description cannot be more than 200 characters'],
        },
        date: {
            type: Date,
            required: [true, 'Please provide a date'],
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// Index for faster queries
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, type: 1 });
transactionSchema.index({ userId: 1, category: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;

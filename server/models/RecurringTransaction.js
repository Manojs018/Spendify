import mongoose from 'mongoose';

const recurringTransactionSchema = new mongoose.Schema(
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
            enum: ['income', 'expense'],
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
        frequency: {
            type: String,
            required: true,
            enum: ['daily', 'weekly', 'monthly', 'yearly'],
        },
        nextProcessingDate: {
            type: Date,
            required: true,
        },
        lastProcessedDate: {
            type: Date,
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

// Indexes
recurringTransactionSchema.index({ userId: 1, isActive: 1, nextProcessingDate: 1 });

const RecurringTransaction = mongoose.model('RecurringTransaction', recurringTransactionSchema);

export default RecurringTransaction;

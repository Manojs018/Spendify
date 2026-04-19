import mongoose from 'mongoose';

/**
 * Budget Model
 * Stores one document per user per month-year combination.
 * Contains an overall monthly limit and an optional array of
 * per-category limits.
 */
const categoryLimitSchema = new mongoose.Schema({
    category: {
        type: String,
        required: true,
        trim: true,
    },
    limit: {
        type: Number,
        required: true,
        min: [0, 'Limit cannot be negative'],
    },
}, { _id: false });

const budgetSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        // e.g. 2026-04 — unique per user per month
        monthKey: {
            type: String,
            required: true,
            match: [/^\d{4}-\d{2}$/, 'monthKey must be in YYYY-MM format'],
        },
        // Overall monthly spending limit (0 = not set)
        overallLimit: {
            type: Number,
            default: 0,
            min: [0, 'Overall limit cannot be negative'],
        },
        // Array of { category, limit } objects
        categoryLimits: {
            type: [categoryLimitSchema],
            default: [],
        },
        // Custom alert threshold percentage (default 80)
        alertThreshold: {
            type: Number,
            default: 80,
            min: [1, 'Threshold must be at least 1%'],
            max: [99, 'Threshold must be less than 100%'],
        },
    },
    { timestamps: true }
);

// One budget doc per user per month
budgetSchema.index({ userId: 1, monthKey: 1 }, { unique: true });

const Budget = mongoose.model('Budget', budgetSchema);

export default Budget;

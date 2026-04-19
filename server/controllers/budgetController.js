import Budget from '../models/Budget.js';
import Transaction from '../models/Transaction.js';

// Helper: get current YYYY-MM key
const getCurrentMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

// Helper: calc start/end of a month key
const getMonthRange = (monthKey) => {
    const [year, month] = monthKey.split('-').map(Number);
    return {
        start: new Date(year, month - 1, 1),
        end: new Date(year, month, 0, 23, 59, 59, 999),
    };
};

/**
 * @desc    Get budget + live spending data for a month
 * @route   GET /api/budgets?month=YYYY-MM
 * @access  Private
 */
export const getBudget = async (req, res) => {
    try {
        const monthKey = req.query.month || getCurrentMonthKey();

        if (!/^\d{4}-\d{2}$/.test(monthKey)) {
            return res.status(400).json({ success: false, message: 'Invalid month format. Use YYYY-MM.' });
        }

        // Fetch budget doc (or empty default)
        const budget = await Budget.findOne({ userId: req.user.id, monthKey });

        // Fetch actual expenses in the month
        const { start, end } = getMonthRange(monthKey);
        const expenses = await Transaction.find({
            userId: req.user.id,
            type: 'expense',
            date: { $gte: start, $lte: end },
        });

        // Aggregate total + per-category spending
        const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);
        const categorySpending = {};
        expenses.forEach(t => {
            categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
        });

        res.status(200).json({
            success: true,
            data: {
                monthKey,
                overallLimit: budget?.overallLimit ?? 0,
                alertThreshold: budget?.alertThreshold ?? 80,
                categoryLimits: budget?.categoryLimits ?? [],
                totalSpent,
                categorySpending,
            },
        });
    } catch (error) {
        console.error('getBudget error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching budget' });
    }
};

/**
 * @desc    Upsert (create or update) budget for a month
 * @route   POST /api/budgets
 * @access  Private
 * @body    { month, overallLimit, alertThreshold, categoryLimits: [{ category, limit }] }
 */
export const upsertBudget = async (req, res) => {
    try {
        const { month, overallLimit, alertThreshold, categoryLimits } = req.body;
        const monthKey = month || getCurrentMonthKey();

        if (!/^\d{4}-\d{2}$/.test(monthKey)) {
            return res.status(400).json({ success: false, message: 'Invalid month format. Use YYYY-MM.' });
        }

        // Validate overall limit
        const parsedOverall = parseFloat(overallLimit) || 0;
        if (parsedOverall < 0) {
            return res.status(400).json({ success: false, message: 'Overall limit cannot be negative.' });
        }

        // Validate alert threshold
        const parsedThreshold = parseInt(alertThreshold) || 80;
        if (parsedThreshold < 1 || parsedThreshold > 99) {
            return res.status(400).json({ success: false, message: 'Alert threshold must be between 1 and 99.' });
        }

        // Sanitize category limits
        const cleanCategoryLimits = Array.isArray(categoryLimits)
            ? categoryLimits
                .filter(cl => cl.category && typeof cl.category === 'string' && parseFloat(cl.limit) >= 0)
                .map(cl => ({ category: String(cl.category).trim(), limit: parseFloat(cl.limit) }))
            : [];

        const updated = await Budget.findOneAndUpdate(
            { userId: req.user.id, monthKey },
            {
                overallLimit: parsedOverall,
                alertThreshold: parsedThreshold,
                categoryLimits: cleanCategoryLimits,
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({
            success: true,
            message: 'Budget saved successfully',
            data: updated,
        });
    } catch (error) {
        console.error('upsertBudget error:', error);
        res.status(500).json({ success: false, message: 'Server error saving budget' });
    }
};

/**
 * @desc    Delete budget for a month
 * @route   DELETE /api/budgets?month=YYYY-MM
 * @access  Private
 */
export const deleteBudget = async (req, res) => {
    try {
        const monthKey = req.query.month || getCurrentMonthKey();
        await Budget.findOneAndDelete({ userId: req.user.id, monthKey });
        res.status(200).json({ success: true, message: 'Budget removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error deleting budget' });
    }
};

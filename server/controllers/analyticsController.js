import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

// @desc    Get monthly analytics
// @route   GET /api/analytics/monthly
// @access  Private
export const getMonthlyAnalytics = async (req, res) => {
    try {
        const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        // Get current month transactions
        const transactions = await Transaction.find({
            userId: req.user.id,
            date: { $gte: startDate, $lte: endDate },
        });

        // Calculate totals
        const income = transactions
            .filter((t) => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const expense = transactions
            .filter((t) => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        // Get previous month for comparison
        const prevStartDate = new Date(year, month - 2, 1);
        const prevEndDate = new Date(year, month - 1, 0, 23, 59, 59);

        const prevTransactions = await Transaction.find({
            userId: req.user.id,
            date: { $gte: prevStartDate, $lte: prevEndDate },
        });

        const prevExpense = prevTransactions
            .filter((t) => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        // Calculate growth percentage
        const growthPercentage =
            prevExpense === 0
                ? 0
                : (((expense - prevExpense) / prevExpense) * 100).toFixed(2);

        res.status(200).json({
            success: true,
            data: {
                period: {
                    month: parseInt(month),
                    year: parseInt(year),
                },
                income,
                expense,
                balance: income - expense,
                transactionCount: transactions.length,
                growthPercentage: parseFloat(growthPercentage),
                comparison: {
                    previousMonth: {
                        expense: prevExpense,
                    },
                },
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get category breakdown
// @route   GET /api/analytics/category
// @access  Private
export const getCategoryAnalytics = async (req, res) => {
    try {
        const { year = new Date().getFullYear(), month, type } = req.query;

        // Build date filter
        let dateFilter = {};
        if (month) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            dateFilter = { $gte: startDate, $lte: endDate };
        } else {
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31, 23, 59, 59);
            dateFilter = { $gte: startDate, $lte: endDate };
        }

        // Build match query
        const matchQuery = {
            userId: req.user._id,
            date: dateFilter,
        };

        if (type && ['income', 'expense'].includes(type)) {
            matchQuery.type = type;
        }

        // Aggregate by category
        const categoryBreakdown = await Transaction.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                    type: { $first: '$type' },
                },
            },
            { $sort: { total: -1 } },
        ]);

        // Calculate total
        const total = categoryBreakdown.reduce((sum, cat) => sum + cat.total, 0);

        // Add percentage to each category
        const categoriesWithPercentage = categoryBreakdown.map((cat) => ({
            category: cat._id,
            amount: cat.total,
            count: cat.count,
            type: cat.type,
            percentage: total === 0 ? 0 : ((cat.total / total) * 100).toFixed(2),
        }));

        res.status(200).json({
            success: true,
            data: {
                categories: categoriesWithPercentage,
                total,
                period: {
                    year: parseInt(year),
                    month: month ? parseInt(month) : null,
                },
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get spending trends
// @route   GET /api/analytics/trends
// @access  Private
export const getTrends = async (req, res) => {
    try {
        const { year = new Date().getFullYear(), months = 6 } = req.query;

        const trends = [];
        const currentMonth = new Date().getMonth();

        for (let i = months - 1; i >= 0; i--) {
            const monthIndex = currentMonth - i;
            const date = new Date(year, monthIndex, 1);
            const month = date.getMonth() + 1;
            const yearForMonth = date.getFullYear();

            const startDate = new Date(yearForMonth, month - 1, 1);
            const endDate = new Date(yearForMonth, month, 0, 23, 59, 59);

            const transactions = await Transaction.find({
                userId: req.user.id,
                date: { $gte: startDate, $lte: endDate },
            });

            const income = transactions
                .filter((t) => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);

            const expense = transactions
                .filter((t) => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0);

            trends.push({
                month: month,
                year: yearForMonth,
                monthName: date.toLocaleString('default', { month: 'short' }),
                income,
                expense,
                balance: income - expense,
            });
        }

        res.status(200).json({
            success: true,
            data: trends,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get dashboard summary
// @route   GET /api/analytics/summary
// @access  Private
export const getDashboardSummary = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        // Get current month data
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const monthlyTransactions = await Transaction.find({
            userId: req.user.id,
            date: { $gte: startOfMonth, $lte: endOfMonth },
        });

        const monthlyIncome = monthlyTransactions
            .filter((t) => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const monthlyExpense = monthlyTransactions
            .filter((t) => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        // Get all-time totals
        const allTransactions = await Transaction.find({ userId: req.user.id });

        const totalIncome = allTransactions
            .filter((t) => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const totalExpense = allTransactions
            .filter((t) => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        // Get recent transactions
        const recentTransactions = await Transaction.find({ userId: req.user.id })
            .sort('-date')
            .limit(5);

        // Get category breakdown for current month
        const categoryBreakdown = await Transaction.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    date: { $gte: startOfMonth, $lte: endOfMonth },
                    type: 'expense',
                },
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
            { $sort: { total: -1 } },
            { $limit: 5 },
        ]);

        res.status(200).json({
            success: true,
            data: {
                balance: user.balance,
                monthly: {
                    income: monthlyIncome,
                    expense: monthlyExpense,
                    balance: monthlyIncome - monthlyExpense,
                },
                allTime: {
                    income: totalIncome,
                    expense: totalExpense,
                },
                recentTransactions,
                topCategories: categoryBreakdown.map((cat) => ({
                    category: cat._id,
                    amount: cat.total,
                    count: cat.count,
                })),
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

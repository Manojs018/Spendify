import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

// @desc    Get all transactions for user
// @route   GET /api/transactions
// @access  Private
export const getTransactions = async (req, res) => {
    try {
        const { type, category, month, year, search, page = 1, limit = 10, sort = '-date' } = req.query;

        // Build query
        const query = { userId: req.user.id };

        // Filter by type
        if (type && ['income', 'expense'].includes(type)) {
            query.type = type;
        }

        // Filter by category
        if (category) {
            query.category = new RegExp(category, 'i');
        }

        // Filter by month and year
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            query.date = { $gte: startDate, $lte: endDate };
        } else if (year) {
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31, 23, 59, 59);
            query.date = { $gte: startDate, $lte: endDate };
        }

        // Search in description
        if (search) {
            query.description = new RegExp(search, 'i');
        }

        // Execute query with pagination
        const transactions = await Transaction.find(query)
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        // Get total count
        const count = await Transaction.countDocuments(query);

        res.status(200).json({
            success: true,
            count: transactions.length,
            total: count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            data: transactions,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get single transaction
// @route   GET /api/transactions/:id
// @access  Private
export const getTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found',
            });
        }

        // Make sure user owns transaction
        if (transaction.userId.toString() !== req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to access this transaction',
            });
        }

        res.status(200).json({
            success: true,
            data: transaction,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create new transaction
// @route   POST /api/transactions
// @access  Private
export const createTransaction = async (req, res) => {
    try {
        const { amount, type, category, description, date } = req.body;

        const transaction = await Transaction.create({
            userId: req.user.id,
            amount,
            type,
            category,
            description,
            date: date || Date.now(),
        });

        // Update user balance
        const user = await User.findById(req.user.id);
        if (type === 'income') {
            user.balance += amount;
        } else {
            user.balance -= amount;
        }
        await user.save();

        res.status(201).json({
            success: true,
            message: 'Transaction created successfully',
            data: transaction,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update transaction
// @route   PUT /api/transactions/:id
// @access  Private
export const updateTransaction = async (req, res) => {
    try {
        let transaction = await Transaction.findById(req.params.id);

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found',
            });
        }

        // Make sure user owns transaction
        if (transaction.userId.toString() !== req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to update this transaction',
            });
        }

        // If amount or type changed, update user balance
        const user = await User.findById(req.user.id);

        // Revert old transaction
        if (transaction.type === 'income') {
            user.balance -= transaction.amount;
        } else {
            user.balance += transaction.amount;
        }

        // Apply new transaction
        const newType = req.body.type || transaction.type;
        const newAmount = req.body.amount || transaction.amount;

        if (newType === 'income') {
            user.balance += newAmount;
        } else {
            user.balance -= newAmount;
        }

        await user.save();

        transaction = await Transaction.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        res.status(200).json({
            success: true,
            message: 'Transaction updated successfully',
            data: transaction,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
// @access  Private
export const deleteTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found',
            });
        }

        // Make sure user owns transaction
        if (transaction.userId.toString() !== req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to delete this transaction',
            });
        }

        // Update user balance
        const user = await User.findById(req.user.id);
        if (transaction.type === 'income') {
            user.balance -= transaction.amount;
        } else {
            user.balance += transaction.amount;
        }
        await user.save();

        await transaction.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Transaction deleted successfully',
            data: {},
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

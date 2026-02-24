import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import {
    escapeRegex,
    validateTransactionBody,
    validateTransactionQuery,
    stripXSS,
} from '../middleware/sanitize.js';

// Allowed sort fields whitelist (prevents sort injection)
const ALLOWED_SORT_FIELDS = [
    'date', '-date', 'amount', '-amount',
    'category', '-category', 'type', '-type',
    'createdAt', '-createdAt',
];

// @desc    Get all transactions for user
// @route   GET /api/transactions
// @access  Private
export const getTransactions = async (req, res) => {
    try {
        const {
            type,
            category,
            month,
            year,
            search,
            page = 1,
            limit = 10,
            sort = '-date',
        } = req.query;

        // ── Validate query params ──────────────────────────────────────────
        const queryErrors = validateTransactionQuery({ type, category, month, year, search, page, limit, sort });
        if (queryErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: queryErrors[0],
                errors: queryErrors,
            });
        }

        // ── Safe pagination (parseInt with bounds) ─────────────────────────
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

        // ── Whitelist sort field to prevent injection ──────────────────────
        const safeSort = ALLOWED_SORT_FIELDS.includes(sort) ? sort : '-date';

        // ── Build query ────────────────────────────────────────────────────
        const query = { userId: req.user.id };

        // Filter by type – already validated to be 'income' or 'expense'
        if (type && ['income', 'expense'].includes(type)) {
            query.type = type;
        }

        // Filter by category – escape user input before building RegExp (ReDoS fix)
        if (category && typeof category === 'string') {
            query.category = new RegExp(escapeRegex(category.trim()), 'i');
        }

        // Filter by month and year – parsed as real integers
        if (month && year) {
            const m = parseInt(month, 10);
            const y = parseInt(year, 10);
            const startDate = new Date(y, m - 1, 1);
            const endDate = new Date(y, m, 0, 23, 59, 59);
            query.date = { $gte: startDate, $lte: endDate };
        } else if (year) {
            const y = parseInt(year, 10);
            const startDate = new Date(y, 0, 1);
            const endDate = new Date(y, 11, 31, 23, 59, 59);
            query.date = { $gte: startDate, $lte: endDate };
        }

        // Search in description – escape user input before building RegExp (ReDoS fix)
        if (search && typeof search === 'string') {
            query.description = new RegExp(escapeRegex(search.trim()), 'i');
        }

        // ── Execute query with safe pagination ────────────────────────────
        const transactions = await Transaction.find(query)
            .sort(safeSort)
            .limit(limitNum)
            .skip((pageNum - 1) * limitNum)
            .exec();

        const count = await Transaction.countDocuments(query);

        res.status(200).json({
            success: true,
            count: transactions.length,
            total: count,
            totalPages: Math.ceil(count / limitNum),
            currentPage: pageNum,
            data: transactions,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error while fetching transactions',
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
            message: 'Server error while fetching transaction',
        });
    }
};

// @desc    Create new transaction
// @route   POST /api/transactions
// @access  Private
export const createTransaction = async (req, res) => {
    try {
        const { amount, type, category, description, date } = req.body;

        // ── Validate input ─────────────────────────────────────────────────
        const validationErrors = validateTransactionBody({ amount, type, category, description, date });
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: validationErrors[0],
                errors: validationErrors,
            });
        }

        // ── Sanitize string fields (XSS already stripped by middleware) ────
        const safeDescription = description ? stripXSS(description.trim()) : undefined;
        const safeCategory = stripXSS(category.trim());
        const safeAmount = parseFloat(amount);

        const transaction = await Transaction.create({
            userId: req.user.id,
            amount: safeAmount,
            type,
            category: safeCategory,
            description: safeDescription,
            date: date ? new Date(date) : Date.now(),
        });

        // Update user balance atomically using $inc to prevent race conditions
        const incrementValue = type === 'income' ? safeAmount : -safeAmount;
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $inc: { balance: incrementValue } },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            // Rollback transaction if user update fails
            await transaction.deleteOne();
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.status(201).json({
            success: true,
            message: 'Transaction created successfully',
            data: transaction,
            balance: updatedUser.balance,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error while creating transaction',
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

        // ── Validate only the supplied fields ─────────────────────────────
        const {
            amount = transaction.amount,
            type = transaction.type,
            category = transaction.category,
            description,
            date,
        } = req.body;

        const validationErrors = validateTransactionBody({
            amount,
            type,
            category,
            description: description !== undefined ? description : transaction.description,
            date: date !== undefined ? date : transaction.date,
        });
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: validationErrors[0],
                errors: validationErrors,
            });
        }

        // ── Build safe update object ───────────────────────────────────────
        const safeAmount = parseFloat(amount);
        const safeCategory = stripXSS(String(category).trim());
        const safeDescription = description !== undefined
            ? stripXSS(String(description).trim())
            : transaction.description;

        // ── Calculate balance adjustment atomically ────────────────────────
        const oldType = transaction.type;
        const oldAmount = transaction.amount;
        const newType = type;
        const newAmount = safeAmount;

        const revertValue = oldType === 'income' ? -oldAmount : oldAmount;
        const applyValue = newType === 'income' ? newAmount : -newAmount;
        const netChange = revertValue + applyValue;

        // Update user balance atomically
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $inc: { balance: netChange } },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Build a safe update object (only known fields, no arbitrary req.body pass-through)
        const updateData = {
            amount: safeAmount,
            type,
            category: safeCategory,
            description: safeDescription,
        };
        if (date !== undefined) {
            updateData.date = new Date(date);
        }

        // Update the transaction
        transaction = await Transaction.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true,
        });

        res.status(200).json({
            success: true,
            message: 'Transaction updated successfully',
            data: transaction,
            balance: updatedUser.balance,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error while updating transaction',
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

        // Update user balance atomically (revert the transaction)
        const revertValue = transaction.type === 'income' ? -transaction.amount : transaction.amount;
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $inc: { balance: revertValue } },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        await transaction.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Transaction deleted successfully',
            data: {},
            balance: updatedUser.balance,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error while deleting transaction',
        });
    }
};

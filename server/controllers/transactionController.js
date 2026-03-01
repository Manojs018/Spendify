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

        // ── Safe pagination  ────────────────────────────────────────────────
        // validateTransactionQuery() above already rejected page<1 and limit>100,
        // so all values here are guaranteed to be valid — no further clamping needed.
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;

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

        // ── Insufficient-funds check for expense transactions ──────────────
        if (type === 'expense') {
            // Atomic conditional update: only deducts if balance >= safeAmount
            // This prevents race conditions (no separate read-then-write)
            const updatedUser = await User.findOneAndUpdate(
                { _id: req.user.id, balance: { $gte: safeAmount } },
                { $inc: { balance: -safeAmount } },
                { new: true }
            );

            if (!updatedUser) {
                // Either user not found OR balance too low — read current balance for clear message
                const currentUser = await User.findById(req.user.id);
                if (!currentUser) {
                    return res.status(404).json({ success: false, message: 'User not found' });
                }
                return res.status(400).json({
                    success: false,
                    message: `Insufficient funds: your balance is $${currentUser.balance.toFixed(2)}`,
                    balance: currentUser.balance,
                });
            }

            // Balance deducted atomically — now create the transaction record
            const transaction = await Transaction.create({
                userId: req.user.id,
                amount: safeAmount,
                type,
                category: safeCategory,
                description: safeDescription,
                date: date ? new Date(date) : Date.now(),
            });

            // Rollback balance if transaction creation fails (rare, defensive)
            if (!transaction) {
                await User.findByIdAndUpdate(req.user.id, { $inc: { balance: safeAmount } });
                return res.status(500).json({ success: false, message: 'Failed to record transaction' });
            }

            return res.status(201).json({
                success: true,
                message: 'Transaction created successfully',
                data: transaction,
                balance: updatedUser.balance,
            });
        }

        // ── Income transaction: just add to balance ────────────────────────
        const transaction = await Transaction.create({
            userId: req.user.id,
            amount: safeAmount,
            type,
            category: safeCategory,
            description: safeDescription,
            date: date ? new Date(date) : Date.now(),
        });

        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $inc: { balance: safeAmount } },
            { new: true }
        );

        if (!updatedUser) {
            await transaction.deleteOne();
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        return res.status(201).json({
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

        // ── Calculate how balance would change ────────────────────────────
        const oldType = transaction.type;
        const oldAmount = transaction.amount;
        const revertValue = oldType === 'income' ? -oldAmount : oldAmount;   // undo old
        const applyValue = type === 'income' ? safeAmount : -safeAmount; // apply new
        const netChange = revertValue + applyValue;

        // ── Guard: net change must not push balance below 0 ───────────────
        if (netChange < 0) {
            // Only use atomic conditional update when the change is a deduction
            const updatedUser = await User.findOneAndUpdate(
                { _id: req.user.id, balance: { $gte: -netChange } },
                { $inc: { balance: netChange } },
                { new: true }
            );

            if (!updatedUser) {
                const currentUser = await User.findById(req.user.id);
                if (!currentUser) {
                    return res.status(404).json({ success: false, message: 'User not found' });
                }
                return res.status(400).json({
                    success: false,
                    message: `Insufficient funds: your balance is $${currentUser.balance.toFixed(2)}`,
                    balance: currentUser.balance,
                });
            }

            // Update the transaction record
            transaction = await Transaction.findByIdAndUpdate(req.params.id, {
                amount: safeAmount, type, category: safeCategory, description: safeDescription,
                ...(date !== undefined ? { date: new Date(date) } : {}),
            }, { new: true, runValidators: true });

            return res.status(200).json({
                success: true,
                message: 'Transaction updated successfully',
                data: transaction,
                balance: updatedUser.balance,
            });
        }

        // ── Net change is zero or positive — safe to apply unconditionally ─
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $inc: { balance: netChange } },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const updateData = {
            amount: safeAmount, type, category: safeCategory, description: safeDescription,
        };
        if (date !== undefined) updateData.date = new Date(date);

        transaction = await Transaction.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true,
        });

        return res.status(200).json({
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

        // ── Revert the balance effect of this transaction ─────────────────
        // Reverting an income = subtract (could go negative if other expenses consumed it)
        // Reverting an expense = add back (always safe)
        const revertValue = transaction.type === 'income' ? -transaction.amount : transaction.amount;

        if (revertValue < 0) {
            // Reverting income: guard against going negative atomically
            const updatedUser = await User.findOneAndUpdate(
                { _id: req.user.id, balance: { $gte: transaction.amount } },
                { $inc: { balance: revertValue } },
                { new: true }
            );

            if (!updatedUser) {
                const currentUser = await User.findById(req.user.id);
                if (!currentUser) {
                    return res.status(404).json({ success: false, message: 'User not found' });
                }
                return res.status(400).json({
                    success: false,
                    message: `Cannot delete: removing this income would result in a negative balance. Current balance: $${currentUser.balance.toFixed(2)}`,
                    balance: currentUser.balance,
                });
            }

            await transaction.deleteOne();
            return res.status(200).json({
                success: true,
                message: 'Transaction deleted successfully',
                data: {},
                balance: updatedUser.balance,
            });
        }

        // Reverting an expense: safe unconditional add-back
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $inc: { balance: revertValue } },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        await transaction.deleteOne();

        return res.status(200).json({
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

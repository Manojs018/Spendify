import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import {
    escapeRegex,
    validateTransferBody,
    validateTransferQuery,
    validateSearchQuery,
    stripXSS,
} from '../middleware/sanitize.js';

// @desc    Send money to another user
// @route   POST /api/transfer/send
// @access  Private
export const sendMoney = async (req, res) => {
    try {
        const { recipientEmail, amount, description } = req.body;

        // ── Validate input ─────────────────────────────────────────────────
        const validationErrors = validateTransferBody({ recipientEmail, amount, description });
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: validationErrors[0],
                errors: validationErrors,
            });
        }

        // ── Sanitize and parse ─────────────────────────────────────────────
        const safeEmail = recipientEmail.trim().toLowerCase();
        const safeAmount = parseFloat(amount);
        const safeDescription = description ? stripXSS(description.trim()) : undefined;

        if (safeAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be greater than 0',
            });
        }

        // Get sender
        const sender = await User.findById(req.user.id);

        // Check if sender has sufficient balance
        if (sender.balance < safeAmount) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance',
            });
        }

        // Find recipient – use exact string match (no regex) to prevent injection
        const recipient = await User.findOne({ email: safeEmail });

        if (!recipient) {
            return res.status(404).json({
                success: false,
                message: 'Recipient not found',
            });
        }

        // Check if sending to self
        if (sender._id.toString() === recipient._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot send money to yourself',
            });
        }

        // Perform atomic balance updates
        const updatedSender = await User.findByIdAndUpdate(
            sender._id,
            { $inc: { balance: -safeAmount } },
            { new: true, runValidators: true }
        );

        if (!updatedSender) {
            return res.status(404).json({
                success: false,
                message: 'Sender not found',
            });
        }

        const updatedRecipient = await User.findByIdAndUpdate(
            recipient._id,
            { $inc: { balance: safeAmount } },
            { new: true, runValidators: true }
        );

        if (!updatedRecipient) {
            // Rollback sender's balance if recipient update fails
            await User.findByIdAndUpdate(
                sender._id,
                { $inc: { balance: safeAmount } },
                { new: true }
            );
            return res.status(404).json({
                success: false,
                message: 'Recipient not found. Transaction rolled back.',
            });
        }

        // Create transaction records (use safe description, not raw user input)
        let senderTransaction, recipientTransaction;
        try {
            // Use sanitized custom description or a safe system-generated one
            const senderDesc = safeDescription || `Sent to ${stripXSS(recipient.name)} (${safeEmail})`;
            const recipientDesc = safeDescription || `Received from ${stripXSS(sender.name)} (${stripXSS(sender.email)})`;

            senderTransaction = await Transaction.create({
                userId: sender._id,
                amount: safeAmount,
                type: 'expense',
                category: 'Transfer',
                description: senderDesc,
                date: Date.now(),
            });

            recipientTransaction = await Transaction.create({
                userId: recipient._id,
                amount: safeAmount,
                type: 'income',
                category: 'Transfer',
                description: recipientDesc,
                date: Date.now(),
            });
        } catch (error) {
            // Rollback balance updates if transaction creation fails
            await User.findByIdAndUpdate(sender._id, { $inc: { balance: safeAmount } });
            await User.findByIdAndUpdate(recipient._id, { $inc: { balance: -safeAmount } });
            throw new Error('Failed to create transaction records. Transfer rolled back.');
        }

        res.status(200).json({
            success: true,
            message: 'Money sent successfully',
            data: {
                sender: {
                    id: updatedSender._id,
                    name: updatedSender.name,
                    newBalance: updatedSender.balance,
                },
                recipient: {
                    id: updatedRecipient._id,
                    name: updatedRecipient.name,
                    email: updatedRecipient.email,
                },
                amount: safeAmount,
                transaction: senderTransaction,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while processing transfer',
        });
    }
};

// @desc    Get transfer history
// @route   GET /api/transfer/history
// @access  Private
export const getTransferHistory = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        // ── Validate pagination params ──────────────────────────────────────
        // validateTransferQuery rejects page < 1 or limit > 100 with a clear
        // HTTP 400 error and descriptive message — no silent clamping here.
        const paginationErrors = validateTransferQuery({ page, limit });
        if (paginationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: paginationErrors[0],
                errors: paginationErrors,
            });
        }

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;

        const transfers = await Transaction.find({
            userId: req.user.id,
            category: 'Transfer',
        })
            .sort('-date')
            .limit(limitNum)
            .skip((pageNum - 1) * limitNum)
            .exec();

        const count = await Transaction.countDocuments({
            userId: req.user.id,
            category: 'Transfer',
        });

        res.status(200).json({
            success: true,
            count: transfers.length,
            total: count,
            totalPages: Math.ceil(count / limitNum),
            currentPage: pageNum,
            data: transfers,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error while fetching transfer history',
        });
    }
};

// @desc    Search users by email
// @route   GET /api/transfer/search
// @access  Private
export const searchUsers = async (req, res) => {
    try {
        const { email } = req.query;

        // ── Validate ───────────────────────────────────────────────────────
        const searchErrors = validateSearchQuery({ email });
        if (searchErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: searchErrors[0],
                errors: searchErrors,
            });
        }

        // ── ReDoS-safe regex: escape user input before building RegExp ─────
        const safeEmailPattern = new RegExp(escapeRegex(email.trim()), 'i');

        const users = await User.find({
            email: safeEmailPattern,
            _id: { $ne: req.user.id }, // Exclude current user
        })
            .select('name email')
            .limit(5);

        res.status(200).json({
            success: true,
            count: users.length,
            data: users,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error while searching users',
        });
    }
};

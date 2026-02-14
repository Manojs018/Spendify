import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

// @desc    Send money to another user
// @route   POST /api/transfer/send
// @access  Private
export const sendMoney = async (req, res) => {
    try {
        const { recipientEmail, amount, description } = req.body;

        if (!recipientEmail || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Please provide recipient email and amount',
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be greater than 0',
            });
        }

        // Get sender
        const sender = await User.findById(req.user.id);

        // Check if sender has sufficient balance
        if (sender.balance < amount) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance',
            });
        }

        // Find recipient
        const recipient = await User.findOne({ email: recipientEmail });

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
        // Deduct from sender
        const updatedSender = await User.findByIdAndUpdate(
            sender._id,
            { $inc: { balance: -amount } },
            { new: true, runValidators: true }
        );

        if (!updatedSender) {
            return res.status(404).json({
                success: false,
                message: 'Sender not found',
            });
        }

        // Add to recipient
        const updatedRecipient = await User.findByIdAndUpdate(
            recipient._id,
            { $inc: { balance: amount } },
            { new: true, runValidators: true }
        );

        if (!updatedRecipient) {
            // Rollback sender's balance if recipient update fails
            await User.findByIdAndUpdate(
                sender._id,
                { $inc: { balance: amount } },
                { new: true }
            );
            return res.status(404).json({
                success: false,
                message: 'Recipient not found. Transaction rolled back.',
            });
        }

        // Create transaction records
        let senderTransaction, recipientTransaction;
        try {
            senderTransaction = await Transaction.create({
                userId: sender._id,
                amount,
                type: 'expense',
                category: 'Transfer',
                description: description || `Sent to ${recipient.name} (${recipient.email})`,
                date: Date.now(),
            });

            recipientTransaction = await Transaction.create({
                userId: recipient._id,
                amount,
                type: 'income',
                category: 'Transfer',
                description: description || `Received from ${sender.name} (${sender.email})`,
                date: Date.now(),
            });
        } catch (error) {
            // Rollback balance updates if transaction creation fails
            await User.findByIdAndUpdate(sender._id, { $inc: { balance: amount } });
            await User.findByIdAndUpdate(recipient._id, { $inc: { balance: -amount } });
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
                amount,
                transaction: senderTransaction,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get transfer history
// @route   GET /api/transfer/history
// @access  Private
export const getTransferHistory = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const transfers = await Transaction.find({
            userId: req.user.id,
            category: 'Transfer',
        })
            .sort('-date')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const count = await Transaction.countDocuments({
            userId: req.user.id,
            category: 'Transfer',
        });

        res.status(200).json({
            success: true,
            count: transfers.length,
            total: count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            data: transfers,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Search users by email
// @route   GET /api/transfer/search
// @access  Private
export const searchUsers = async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email to search',
            });
        }

        const users = await User.find({
            email: new RegExp(email, 'i'),
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
            message: error.message,
        });
    }
};

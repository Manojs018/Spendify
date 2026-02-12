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

        // Perform transfer
        sender.balance -= amount;
        recipient.balance += amount;

        await sender.save();
        await recipient.save();

        // Create transaction records
        const senderTransaction = await Transaction.create({
            userId: sender._id,
            amount,
            type: 'expense',
            category: 'Transfer',
            description: description || `Sent to ${recipient.name} (${recipient.email})`,
            date: Date.now(),
        });

        const recipientTransaction = await Transaction.create({
            userId: recipient._id,
            amount,
            type: 'income',
            category: 'Transfer',
            description: description || `Received from ${sender.name} (${sender.email})`,
            date: Date.now(),
        });

        res.status(200).json({
            success: true,
            message: 'Money sent successfully',
            data: {
                sender: {
                    id: sender._id,
                    name: sender.name,
                    newBalance: sender.balance,
                },
                recipient: {
                    id: recipient._id,
                    name: recipient.name,
                    email: recipient.email,
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

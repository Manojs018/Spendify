import mongoose from 'mongoose';
import Card from '../models/Card.js';
import Transaction from '../models/Transaction.js';
import { invalidateUserCache } from '../middleware/cache.js';

// @desc    Get all cards for user
// @route   GET /api/cards
// @access  Private
export const getCards = async (req, res) => {
    try {
        const cards = await Card.find({ userId: req.user.id, isActive: true });

        res.status(200).json({
            success: true,
            count: cards.length,
            data: cards,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get single card
// @route   GET /api/cards/:id
// @access  Private
export const getCard = async (req, res) => {
    try {
        const card = await Card.findById(req.params.id);

        if (!card) {
            return res.status(404).json({
                success: false,
                message: 'Card not found',
            });
        }

        // Make sure user owns card
        if (card.userId.toString() !== req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to access this card',
            });
        }

        res.status(200).json({
            success: true,
            data: card,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create new card
// @route   POST /api/cards
// @access  Private
export const createCard = async (req, res) => {
    try {
        const { cardNumber, cardHolderName, expiry, cvv, balance } = req.body;

        // Validate required fields
        if (!cardNumber || !cardHolderName || !expiry) {
            return res.status(400).json({
                success: false,
                message: 'Please provide card number, holder name, and expiry date',
            });
        }

        // Create new card instance
        const card = new Card({
            userId: req.user.id,
            cardHolderName,
            expiry,
            balance: balance || 0,
        });

        // Set card number (this will encrypt it automatically)
        try {
            card.setCardNumber(cardNumber);
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }

        // Validate CVV if provided (but DON'T store it)
        if (cvv) {
            try {
                card.validateCVV(cvv);
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }
        }

        // Save the card (encrypted)
        await card.save();

        // Invalidate cache
        await invalidateUserCache(req.user.id, 'cards');
        await invalidateUserCache(req.user.id, 'analytics');

        res.status(201).json({
            success: true,
            message: 'Card added successfully',
            data: card,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update card
// @route   PUT /api/cards/:id
// @access  Private
export const updateCard = async (req, res) => {
    try {
        let card = await Card.findById(req.params.id);

        if (!card) {
            return res.status(404).json({
                success: false,
                message: 'Card not found',
            });
        }

        // Make sure user owns card
        if (card.userId.toString() !== req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to update this card',
            });
        }

        // Only allow updating certain fields
        const allowedUpdates = ['cardHolderName', 'expiry', 'balance', 'isActive'];
        const updates = {};

        for (const key of allowedUpdates) {
            if (req.body[key] !== undefined) {
                updates[key] = req.body[key];
            }
        }

        // If card number is being updated, encrypt it
        if (req.body.cardNumber) {
            try {
                card.setCardNumber(req.body.cardNumber);
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }
        }

        // Apply other updates
        Object.assign(card, updates);
        await card.save();

        // Invalidate cache
        await invalidateUserCache(req.user.id, 'cards');
        await invalidateUserCache(req.user.id, 'analytics');

        res.status(200).json({
            success: true,
            message: 'Card updated successfully',
            data: card,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete card
// @route   DELETE /api/cards/:id
// @access  Private
export const deleteCard = async (req, res) => {
    try {
        const card = await Card.findById(req.params.id);

        if (!card) {
            return res.status(404).json({
                success: false,
                message: 'Card not found',
            });
        }

        // Make sure user owns card
        if (card.userId.toString() !== req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to delete this card',
            });
        }

        // Soft delete - mark as inactive
        card.isActive = false;
        await card.save();

        // Invalidate cache
        await invalidateUserCache(req.user.id, 'cards');
        await invalidateUserCache(req.user.id, 'analytics');

        res.status(200).json({
            success: true,
            message: 'Card deleted successfully',
            data: {},
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Transfer money between cards
// @route   POST /api/cards/transfer
// @access  Private
export const transferBetweenCards = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        const { fromCardId, toCardId, amount } = req.body;

        if (!fromCardId || !toCardId || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Please provide fromCardId, toCardId, and amount',
            });
        }

        const safeAmount = parseFloat(amount);
        if (safeAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be greater than 0',
            });
        }

        let result;
        await session.withTransaction(async () => {
            // Get both cards
            const fromCard = await Card.findById(fromCardId).session(session);
            const toCard = await Card.findById(toCardId).session(session);

            if (!fromCard || !toCard) {
                throw new Error('One or both cards not found');
            }

            // Verify user owns both cards
            if (
                fromCard.userId.toString() !== req.user.id ||
                toCard.userId.toString() !== req.user.id
            ) {
                throw new Error('Not authorized to perform this transfer');
            }

            // Check sufficient balance
            if (fromCard.balance < safeAmount) {
                throw new Error('Insufficient balance in source card');
            }

            // Perform atomic balance updates
            // Deduct from source card
            const updatedFromCard = await Card.findByIdAndUpdate(
                fromCardId,
                { $inc: { balance: -safeAmount } },
                { new: true, runValidators: true, session }
            );

            if (!updatedFromCard) {
                throw new Error('Source card update failed');
            }

            // Add to destination card
            const updatedToCard = await Card.findByIdAndUpdate(
                toCardId,
                { $inc: { balance: safeAmount } },
                { new: true, runValidators: true, session }
            );

            if (!updatedToCard) {
                throw new Error('Destination card update failed');
            }

            // Create transaction records
            await Transaction.create(
                [
                    {
                        userId: req.user.id,
                        amount: safeAmount,
                        type: 'expense',
                        category: 'Transfer',
                        description: `Transfer to card ending in ${toCard.lastFourDigits} `,
                        date: Date.now(),
                    },
                ],
                { session }
            );

            await Transaction.create(
                [
                    {
                        userId: req.user.id,
                        amount: safeAmount,
                        type: 'income',
                        category: 'Transfer',
                        description: `Transfer from card ending in ${fromCard.lastFourDigits} `,
                        date: Date.now(),
                    },
                ],
                { session }
            );

            result = { updatedFromCard, updatedToCard };
        });

        const { updatedFromCard, updatedToCard } = result;

        // Invalidate cache
        await invalidateUserCache(req.user.id, 'cards');
        await invalidateUserCache(req.user.id, 'transactions');
        await invalidateUserCache(req.user.id, 'analytics');

        res.status(200).json({
            success: true,
            message: 'Transfer completed successfully',
            data: {
                fromCard: {
                    id: updatedFromCard._id,
                    maskedNumber: updatedFromCard.maskedNumber,
                    balance: updatedFromCard.balance,
                },
                toCard: {
                    id: updatedToCard._id,
                    maskedNumber: updatedToCard.maskedNumber,
                    balance: updatedToCard.balance,
                },
                amount: safeAmount,
            },
        });
    } catch (error) {
        const cardKnownErrors = [
            'One or both cards not found',
            'Not authorized to perform this transfer',
            'Insufficient balance in source card',
        ];

        res.status(cardKnownErrors.includes(error.message) ? 400 : 500).json({
            success: false,
            message: error.message || 'Server error while processing card transfer',
        });
    } finally {
        await session.endSession();
    }
};

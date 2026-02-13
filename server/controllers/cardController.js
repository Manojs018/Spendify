import Card from '../models/Card.js';
import Transaction from '../models/Transaction.js';

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
    try {
        const { fromCardId, toCardId, amount } = req.body;

        if (!fromCardId || !toCardId || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Please provide fromCardId, toCardId, and amount',
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be greater than 0',
            });
        }

        // Get both cards
        const fromCard = await Card.findById(fromCardId);
        const toCard = await Card.findById(toCardId);

        if (!fromCard || !toCard) {
            return res.status(404).json({
                success: false,
                message: 'One or both cards not found',
            });
        }

        // Verify user owns both cards
        if (
            fromCard.userId.toString() !== req.user.id ||
            toCard.userId.toString() !== req.user.id
        ) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to perform this transfer',
            });
        }

        // Check sufficient balance
        if (fromCard.balance < amount) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance in source card',
            });
        }

        // Perform transfer
        fromCard.balance -= amount;
        toCard.balance += amount;

        await fromCard.save();
        await toCard.save();

        // Create transaction records using last 4 digits
        await Transaction.create({
            userId: req.user.id,
            amount,
            type: 'expense',
            category: 'Transfer',
            description: `Transfer to card ending in ${toCard.lastFourDigits}`,
            date: Date.now(),
        });

        await Transaction.create({
            userId: req.user.id,
            amount,
            type: 'income',
            category: 'Transfer',
            description: `Transfer from card ending in ${fromCard.lastFourDigits}`,
            date: Date.now(),
        });

        res.status(200).json({
            success: true,
            message: 'Transfer completed successfully',
            data: {
                fromCard: {
                    id: fromCard._id,
                    maskedNumber: fromCard.maskedNumber,
                    balance: fromCard.balance,
                },
                toCard: {
                    id: toCard._id,
                    maskedNumber: toCard.maskedNumber,
                    balance: toCard.balance,
                },
                amount,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

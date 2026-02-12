import Card from '../models/Card.js';
import Transaction from '../models/Transaction.js';

// @desc    Get all cards for user
// @route   GET /api/cards
// @access  Private
export const getCards = async (req, res) => {
    try {
        const cards = await Card.find({ userId: req.user.id, isActive: true }).select('-cvv');

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
        const card = await Card.findById(req.params.id).select('-cvv');

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
        const { cardNumber, cardHolderName, expiry, cvv, balance, cardType } = req.body;

        // Detect card type from card number if not provided
        let detectedCardType = cardType || 'other';
        if (!cardType && cardNumber) {
            const firstDigit = cardNumber.charAt(0);
            if (firstDigit === '4') detectedCardType = 'visa';
            else if (firstDigit === '5') detectedCardType = 'mastercard';
            else if (firstDigit === '3') detectedCardType = 'amex';
            else if (firstDigit === '6') detectedCardType = 'discover';
        }

        const card = await Card.create({
            userId: req.user.id,
            cardNumber,
            cardHolderName,
            expiry,
            cvv,
            balance: balance || 0,
            cardType: detectedCardType,
        });

        // Remove CVV from response
        const cardResponse = card.toObject();
        delete cardResponse.cvv;

        res.status(201).json({
            success: true,
            message: 'Card added successfully',
            data: cardResponse,
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

        card = await Card.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        }).select('-cvv');

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

        // Create transaction records
        await Transaction.create({
            userId: req.user.id,
            amount,
            type: 'expense',
            category: 'Transfer',
            description: `Transfer to card ending in ${toCard.cardNumber.slice(-4)}`,
            date: Date.now(),
        });

        await Transaction.create({
            userId: req.user.id,
            amount,
            type: 'income',
            category: 'Transfer',
            description: `Transfer from card ending in ${fromCard.cardNumber.slice(-4)}`,
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

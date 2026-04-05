import RecurringTransaction from '../models/RecurringTransaction.js';

// @desc    Get all recurring transactions for user
// @route   GET /api/recurring-transactions
// @access  Private
export const getRecurringTransactions = async (req, res) => {
    try {
        const recurringTransactions = await RecurringTransaction.find({ 
            userId: req.user.id,
            isActive: true
        }).sort('nextProcessingDate');

        res.status(200).json({
            success: true,
            count: recurringTransactions.length,
            data: recurringTransactions,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error while fetching recurring transactions',
        });
    }
};

// @desc    Update recurring transaction
// @route   PUT /api/recurring-transactions/:id
// @access  Private
export const updateRecurringTransaction = async (req, res) => {
    try {
        const { amount, frequency, isActive } = req.body;
        let recurring = await RecurringTransaction.findById(req.params.id);

        if (!recurring) {
            return res.status(404).json({
                success: false,
                message: 'Recurring transaction not found',
            });
        }

        if (recurring.userId.toString() !== req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized',
            });
        }

        recurring = await RecurringTransaction.findByIdAndUpdate(
            req.params.id,
            { amount, frequency, isActive },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            data: recurring,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error while updating recurring transaction',
        });
    }
};

// @desc    Delete/Cancel recurring transaction
// @route   DELETE /api/recurring-transactions/:id
// @access  Private
export const deleteRecurringTransaction = async (req, res) => {
    try {
        const recurring = await RecurringTransaction.findById(req.params.id);

        if (!recurring) {
            return res.status(404).json({
                success: false,
                message: 'Recurring transaction not found',
            });
        }

        if (recurring.userId.toString() !== req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized',
            });
        }

        await recurring.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Recurring transaction cancelled successfully',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error while deleting recurring transaction',
        });
    }
};

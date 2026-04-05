import cron from 'node-cron';
import mongoose from 'mongoose';
import RecurringTransaction from '../models/RecurringTransaction.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import logger from './logger.js';
import { invalidateUserCache } from '../middleware/cache.js';

import { getNextDate } from './dateUtils.js';

export const startCronJobs = () => {
    // Run every midnight (00:00)
    cron.schedule('0 0 * * *', async () => {
        logger.info('Running recurring transactions cron job...');
        
        try {
            const today = new Date();
            today.setHours(23, 59, 59, 999); // Include entire day

            const recurringTasks = await RecurringTransaction.find({
                isActive: true,
                nextProcessingDate: { $lte: today }
            });

            if (recurringTasks.length === 0) {
                logger.info('No recurring transactions due today.');
                return;
            }

            for (const task of recurringTasks) {
                const session = await mongoose.startSession();
                try {
                    await session.withTransaction(async () => {
                        // 1. Update user balance
                        const amountChange = task.type === 'income' ? task.amount : -task.amount;
                        const user = await User.findByIdAndUpdate(
                            task.userId,
                            { $inc: { balance: amountChange } },
                            { session, new: true }
                        );

                        if (!user) throw new Error(`User ${task.userId} not found`);

                        // 2. Create transaction record
                        await Transaction.create([{
                            userId: task.userId,
                            amount: task.amount,
                            type: task.type,
                            category: task.category,
                            description: task.description + ' (Recurring)',
                            date: task.nextProcessingDate // Record on the scheduled date
                        }], { session });

                        // 3. Update recurring task
                        task.lastProcessedDate = task.nextProcessingDate;
                        task.nextProcessingDate = getNextDate(task.nextProcessingDate, task.frequency);
                        await task.save({ session });
                        
                        // Invalidate cache
                        await invalidateUserCache(task.userId, 'transactions');
                        await invalidateUserCache(task.userId, 'analytics');
                    });
                    
                    logger.info(`Processed recurring ${task.type} for user ${task.userId}: ${task.amount}`);
                } catch (error) {
                    logger.error(`Failed to process recurring task ${task._id}:`, error);
                } finally {
                    await session.endSession();
                }
            }
        } catch (error) {
            logger.error('Error in recurring transactions cron job:', error);
        }
    });
    
    logger.info('Cron jobs initialized.');
};

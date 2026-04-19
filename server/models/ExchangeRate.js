import mongoose from 'mongoose';

const exchangeRateSchema = new mongoose.Schema(
    {
        baseCurrency: {
            type: String,
            required: true,
            default: 'USD',
            unique: true
        },
        rates: {
            type: Map,
            of: Number,
            required: true
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true }
);

const ExchangeRate = mongoose.model('ExchangeRate', exchangeRateSchema);
export default ExchangeRate;

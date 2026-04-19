import ExchangeRate from '../models/ExchangeRate.js';

const CACHE_LIFETIME = 24 * 60 * 60 * 1000; // 24 hours

export const fetchAndCacheRates = async (baseCurrency = 'USD') => {
    try {
        // We use the free open API
        const res = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`);
        const data = await res.json();
        const rates = data.rates;

        if (!rates) throw new Error("Invalid response from exchange API");

        // Save to DB
        const updated = await ExchangeRate.findOneAndUpdate(
            { baseCurrency },
            { rates, lastUpdated: new Date() },
            { upsert: true, new: true }
        );
        return updated.rates;
    } catch (error) {
        console.error('Failed to fetch exchange rates:', error.message);
        
        // Fallback: load from DB
        const existing = await ExchangeRate.findOne({ baseCurrency });
        if (existing && existing.rates) {
            console.log('Using fallback exchange rates from database cache.');
            return existing.rates;
        }
        
        // Hard fallback for standard currencies if even DB is empty
        console.warn('CRITICAL: No rates available. Using 1:1 fallback.');
        return new Map([['USD', 1], ['EUR', 0.9], ['GBP', 0.8], ['INR', 83]]); 
    }
};

export const getRates = async (baseCurrency = 'USD') => {
    const existing = await ExchangeRate.findOne({ baseCurrency });
    
    // Refresh if missing or older than 24 hours
    if (!existing || (Date.now() - existing.lastUpdated.getTime() > CACHE_LIFETIME)) {
        return await fetchAndCacheRates(baseCurrency);
    }
    
    return existing.rates;
};

export const convertCurrency = async (amount, fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) return amount;
    
    // We normalize to USD first to safely convert
    const rates = await getRates('USD');
    
    let amountInUSD = amount;
    if (fromCurrency !== 'USD') {
        const fromRate = rates.get ? rates.get(fromCurrency) : rates[fromCurrency];
        if (!fromRate) return amount; // safe fallback
        amountInUSD = amount / fromRate;
    }
    
    if (toCurrency === 'USD') return amountInUSD;
    
    const toRate = rates.get ? rates.get(toCurrency) : rates[toCurrency];
    if (!toRate) return amountInUSD;
    
    return amountInUSD * toRate;
};

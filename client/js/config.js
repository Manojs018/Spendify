// API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// API Endpoints
const API_ENDPOINTS = {
    // Auth
    register: `${API_BASE_URL}/auth/register`,
    login: `${API_BASE_URL}/auth/login`,
    me: `${API_BASE_URL}/auth/me`,

    // Transactions
    transactions: `${API_BASE_URL}/transactions`,
    transaction: (id) => `${API_BASE_URL}/transactions/${id}`,

    // Cards
    cards: `${API_BASE_URL}/cards`,
    card: (id) => `${API_BASE_URL}/cards/${id}`,
    cardTransfer: `${API_BASE_URL}/cards/transfer`,

    // Analytics
    analyticsSummary: `${API_BASE_URL}/analytics/summary`,
    analyticsMonthly: `${API_BASE_URL}/analytics/monthly`,
    analyticsCategory: `${API_BASE_URL}/analytics/category`,
    analyticsTrends: `${API_BASE_URL}/analytics/trends`,

    // Transfer
    transferSend: `${API_BASE_URL}/transfer/send`,
    transferHistory: `${API_BASE_URL}/transfer/history`,
    transferSearch: `${API_BASE_URL}/transfer/search`,
};

// Local Storage Keys
const STORAGE_KEYS = {
    token: 'spendify_token',
    user: 'spendify_user',
};

// Transaction Categories
const TRANSACTION_CATEGORIES = {
    income: [
        'Salary',
        'Freelance',
        'Investment',
        'Gift',
        'Refund',
        'Transfer',
        'Other Income',
    ],
    expense: [
        'Food & Dining',
        'Shopping',
        'Transportation',
        'Bills & Utilities',
        'Entertainment',
        'Healthcare',
        'Education',
        'Travel',
        'Transfer',
        'Other Expense',
    ],
};

// Card Types
const CARD_TYPES = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'American Express',
    discover: 'Discover',
    other: 'Other',
};

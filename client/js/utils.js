// ===================================
// UTILITY FUNCTIONS
// ===================================

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
}

// Format date
function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(new Date(date));
}

// Format date for input
function formatDateForInput(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Get auth token
function getToken() {
    return localStorage.getItem(STORAGE_KEYS.token);
}

// Set auth token
function setToken(token) {
    localStorage.setItem(STORAGE_KEYS.token, token);
}

// Remove auth token
function removeToken() {
    localStorage.removeItem(STORAGE_KEYS.token);
}

// Get user data
function getUser() {
    const user = localStorage.getItem(STORAGE_KEYS.user);
    return user ? JSON.parse(user) : null;
}

// Set user data
function setUser(user) {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
}

// Remove user data
function removeUser() {
    localStorage.removeItem(STORAGE_KEYS.user);
}

// Check if user is authenticated
function isAuthenticated() {
    return !!getToken();
}

// Logout user
function logout() {
    removeToken();
    removeUser();
    window.location.href = 'index.html';
}

// API request helper
async function apiRequest(url, options = {}) {
    const token = getToken();

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (token) {
        defaultOptions.headers['Authorization'] = `Bearer ${token}`;
    }

    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers,
        },
    };

    try {
        const response = await fetch(url, finalOptions);
        const data = await response.json();

        if (!response.ok) {
            // Handle 401 Unauthorized
            if (response.status === 401) {
                logout();
                throw new Error('Session expired. Please login again.');
            }

            throw new Error(data.message || 'Something went wrong');
        }

        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}

// Mask card number
function maskCardNumber(cardNumber) {
    const last4 = cardNumber.slice(-4);
    return `**** **** **** ${last4}`;
}

// Get card type from number
function getCardType(cardNumber) {
    const firstDigit = cardNumber.charAt(0);

    if (firstDigit === '4') return 'visa';
    if (firstDigit === '5') return 'mastercard';
    if (firstDigit === '3') return 'amex';
    if (firstDigit === '6') return 'discover';

    return 'other';
}

// Validate email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Validate card number (basic)
function validateCardNumber(cardNumber) {
    const cleaned = cardNumber.replace(/\s/g, '');
    return /^\d{16}$/.test(cleaned);
}

// Validate expiry date
function validateExpiry(expiry) {
    return /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry);
}

// Validate CVV
function validateCVV(cvv) {
    return /^\d{3,4}$/.test(cvv);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Calculate percentage change
function calculatePercentageChange(current, previous) {
    if (previous === 0) return 0;
    return (((current - previous) / previous) * 100).toFixed(2);
}

// Get month name
function getMonthName(monthNumber) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthNumber - 1];
}

// Animate number counter
function animateCounter(element, target, duration = 1000) {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = Math.round(target);
            clearInterval(timer);
        } else {
            element.textContent = Math.round(current);
        }
    }, 16);
}

// Show loading state
function showLoading(button) {
    const text = button.querySelector('span:first-child');
    const loader = button.querySelector('.btn-loader');

    if (text) text.style.display = 'none';
    if (loader) loader.style.display = 'inline-flex';
    button.disabled = true;
}

// Hide loading state
function hideLoading(button) {
    const text = button.querySelector('span:first-child');
    const loader = button.querySelector('.btn-loader');

    if (text) text.style.display = 'inline';
    if (loader) loader.style.display = 'none';
    button.disabled = false;
}

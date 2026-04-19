// ===================================
// UTILITY FUNCTIONS & SW REGISTRATION
// ===================================

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('SW: Registered', reg))
            .catch(err => console.error('SW: Registration failed', err));
    });
}

// Network Status Listeners
window.addEventListener('online', () => {
    showToast('You are back online! Syncing data...', 'success');
    document.body.classList.remove('is-offline');
    syncOfflineData();
});

window.addEventListener('offline', () => {
    showToast('You are offline. Some features may be limited.', 'warning');
    document.body.classList.add('is-offline');
});

const OFFLINE_QUEUE_KEY = 'spendify_offline_queue';

function queueOfflineRequest(url, options) {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    // Only queue mutations (POST, PUT, DELETE)
    if (options.method && options.method.toUpperCase() !== 'GET') {
        queue.push({ url, options, id: Date.now() });
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }
}

async function syncOfflineData() {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    if (queue.length === 0) return;

    console.log(`SW: Syncing ${queue.length} offline requests...`);

    // Create a copy to iterate
    const requests = [...queue];
    // Clear the queue first to avoid double-processing if sync takes time
    localStorage.setItem(OFFLINE_QUEUE_KEY, '[]');

    for (const item of requests) {
        try {
            await apiRequest(item.url, item.options);
        } catch (error) {
            console.error('SW: Failed to sync offline request:', error);
            // Re-queue if it failed due to network still being unstable
            if (!navigator.onLine) {
                const currentQueue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
                currentQueue.push(item);
                localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(currentQueue));
            }
        }
    }

    const finalQueue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    if (finalQueue.length === 0 && requests.length > 0) {
        showToast('All offline data synchronized!', 'success');
    }
}


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
function formatCurrency(amount, currencyCode) {
    let code = currencyCode;
    if (!code) {
        const user = getUser() || {};
        code = user.baseCurrency || 'USD';
    }
    
    // Normalize to handle potential case issues
    code = code.toUpperCase();
    
    // Fallback catching just in case user object is malformed
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: code,
        }).format(amount);
    } catch(e) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    }
}


// Render Amount block supporting multi-currency Sub-Display
function renderAmount(amount, baseAmount, currency, type, showSign = true) {
    const sign = showSign ? (type === 'income' ? '+' : '-') : '';
    const userCurrency = (getUser() || {}).baseCurrency || 'USD';
    const mainHtml = `${sign}${formatCurrency(baseAmount || amount, userCurrency)}`;
    const subHtml = (currency && currency.toUpperCase() !== userCurrency.toUpperCase()) 
        ? `<span style="font-size: 11px; display:block; color:var(--text-tertiary);">${sign}${formatCurrency(amount, currency)}</span>` 
        : '';
    return `${mainHtml}\n${subHtml}`;
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

// Escape HTML
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
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

// ─────────────────────────────────────────────────────────
// OAuth Callback Bootstrap
// When redirected from /api/auth/google/callback the backend
// appends token, refreshToken, userName, userId, userEmail
// as query params.  We harvest them immediately so the rest
// of the page loads in an authenticated state.
// ─────────────────────────────────────────────────────────
(function bootstrapOAuthTokens() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const refreshToken = params.get('refreshToken');
    if (!token) return;

    // Persist auth state
    localStorage.setItem('spendify_token', token);
    if (refreshToken) localStorage.setItem('spendify_refresh_token', refreshToken);

    // Build minimal user object from query params
    const userName  = params.get('userName')  || '';
    const userId    = params.get('userId')    || '';
    const userEmail = params.get('userEmail') || '';
    if (userId) {
        const userObj = { id: userId, name: userName, email: userEmail };
        localStorage.setItem('spendify_user', JSON.stringify(userObj));
    }

    // Strip params from URL without reloading
    const clean = window.location.pathname;
    window.history.replaceState({}, document.title, clean);
})();

let storedCsrfToken = null;


// Get CSRF token from cookie or API
async function getCsrfToken() {
    let token = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    if (token) return token[1];

    if (storedCsrfToken) return storedCsrfToken;

    try {
        const response = await fetch(`${API_BASE_URL}/csrf-token`, { method: 'GET', credentials: 'include' });
        const data = await response.json();
        storedCsrfToken = data.csrfToken;
        return storedCsrfToken;
    } catch {
        return null;
    }
}

// API request helper
async function apiRequest(url, options = {}) {
    const token = getToken();

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include', // Include credentials to send XSRF-TOKEN cookie back
    };

    if (token) {
        defaultOptions.headers['Authorization'] = `Bearer ${token}`;
    }

    // Attach CSRF token if it's a state-changing method
    const method = options.method ? options.method.toUpperCase() : 'GET';
    const csrfToken = await getCsrfToken();
    if (csrfToken && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        defaultOptions.headers['X-XSRF-TOKEN'] = csrfToken;
    }

    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers,
        },
    };

    // Offline Handling
    if (!navigator.onLine && method !== 'GET') {
        queueOfflineRequest(url, options);
        showToast('Saving locally – will sync when connected', 'info');
        return { success: true, offline: true, message: 'Saved offline' };
    }

    try {
        const response = await fetch(url, finalOptions);
        const data = await response.json();

        if (!response.ok) {
            // 429 – Rate limit exceeded
            if (response.status === 429) {
                const retry = data.retryAfter || '15';
                throw new Error(data.message || `Too many attempts. Please wait ${retry} minutes and try again.`);
            }

            // 423 – Account locked
            if (response.status === 423) {
                throw new Error(data.message || 'Account is temporarily locked. Please try again later.');
            }

            // 401 – Unauthorised (only auto-logout for authenticated routes, not login/register)
            if (response.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/register')) {
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

// Get skeleton HTML
function getSkeletonHTML(type, count = 1) {
    let html = '';
    for (let i = 0; i < count; i++) {
        switch (type) {
            case 'list-item':
                html += `
          <div class="skeleton-item">
            <div class="skeleton skeleton-circle"></div>
            <div style="flex: 1;">
              <div class="skeleton skeleton-title" style="width: 40%;"></div>
              <div class="skeleton skeleton-text" style="width: 70%;"></div>
            </div>
            <div style="width: 60px;">
              <div class="skeleton skeleton-text" style="width: 100%;"></div>
              <div class="skeleton skeleton-text" style="width: 60%; margin-left: auto;"></div>
            </div>
          </div>
        `;
                break;
            case 'card':
                html += `
          <div class="skeleton skeleton-card" style="margin-bottom: var(--space-md);"></div>
        `;
                break;
            case 'category':
                html += `
          <div style="margin-bottom: var(--space-md);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <div class="skeleton skeleton-text" style="width: 30%;"></div>
              <div class="skeleton skeleton-text" style="width: 15%;"></div>
            </div>
            <div class="skeleton skeleton-text" style="height: 8px;"></div>
          </div>
        `;
                break;
        }
    }
    return html;
}

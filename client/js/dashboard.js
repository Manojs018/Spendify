// ===================================
// DASHBOARD LOGIC
// ===================================

// Check authentication on page load
if (!isAuthenticated()) {
    window.location.href = 'index.html';
}

// Global state
let currentPage = 'dashboard';
let transactions = [];
let cards = [];
let editingTransactionId = null;
let isPageTransitioning = false;

// DOM Elements
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const navItems = document.querySelectorAll('.nav-item');
const pageTitle = document.getElementById('pageTitle');
const logoutBtn = document.getElementById('logoutBtn');

// Content sections
const dashboardContent = document.getElementById('dashboardContent');
const transactionsContent = document.getElementById('transactionsContent');
const cardsContent = document.getElementById('cardsContent');
const analyticsContent = document.getElementById('analyticsContent');
const transferContent = document.getElementById('transferContent');
const recurringContent = document.getElementById('recurringContent');

// Modals
const transactionModal = document.getElementById('transactionModal');
const cardModal = document.getElementById('cardModal');

// ===================================
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', async () => {
    await loadUserData();
    await loadDashboardData();
    setupEventListeners();
    populateCategoryOptions();
    setupInteractiveMotion();
});

// ===================================
// USER DATA
// ===================================

async function loadUserData() {
    try {
        const user = getUser();
        if (user) {
            document.getElementById('userName').textContent = user.name;
            document.getElementById('userEmail').textContent = user.email;
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// ===================================
// DASHBOARD DATA
// ===================================

async function loadDashboardData() {
    // Show skeletons
    document.getElementById('recentTransactions').innerHTML = getSkeletonHTML('list-item', 5);
    document.getElementById('topCategories').innerHTML = getSkeletonHTML('category', 4);

    // Stats skeletons
    const statValues = ['totalBalance', 'monthlyIncome', 'monthlyExpense', 'monthlyBalance'];
    statValues.forEach(id => {
        document.getElementById(id).innerHTML = '<div class="skeleton skeleton-text" style="width: 80px; height: 24px; margin: 0 auto;"></div>';
    });

    try {
        const response = await apiRequest(API_ENDPOINTS.analyticsSummary);

        if (response.success) {
            const data = response.data;

            // Update stats cards
            animateCurrencyCounter(document.getElementById('totalBalance'), data.balance);
            animateCurrencyCounter(document.getElementById('monthlyIncome'), data.monthly.income);
            animateCurrencyCounter(document.getElementById('monthlyExpense'), data.monthly.expense);
            animateCurrencyCounter(document.getElementById('monthlyBalance'), data.monthly.balance);

            // Update chart
            document.getElementById('chartIncome').textContent = formatCurrency(data.monthly.income);
            document.getElementById('chartExpense').textContent = formatCurrency(data.monthly.expense);

            // Load recent transactions
            displayRecentTransactions(data.recentTransactions);

            // Load top categories
            displayTopCategories(data.topCategories);
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showToast('Failed to load dashboard data', 'error');
    }

    // Load cards
    await loadCards();
}

// ===================================
// DISPLAY FUNCTIONS
// ===================================

function displayRecentTransactions(transactionsData) {
    const container = document.getElementById('recentTransactions');

    if (!transactionsData || transactionsData.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <p>No transactions yet</p>
      </div>
    `;
        return;
    }

    container.innerHTML = transactionsData.map(transaction => `
    <div class="transaction-item">
      <div class="transaction-icon ${transaction.type}">
        ${transaction.type === 'income' ? '📈' : '📉'}
      </div>
      <div class="transaction-details">
        <p class="transaction-category">${transaction.category}</p>
        <p class="transaction-description">${transaction.description || 'No description'}</p>
      </div>
      <div style="text-align: right;">
        <p class="transaction-amount ${transaction.type === 'income' ? 'text-success' : 'text-danger'}">
          ${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}
        </p>
        <p class="transaction-date">${formatDate(transaction.date)}</p>
      </div>
    </div>
  `).join('');
}

function displayTopCategories(categoriesData) {
    const container = document.getElementById('topCategories');

    if (!categoriesData || categoriesData.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <p>No category data yet</p>
      </div>
    `;
        return;
    }

    const maxAmount = Math.max(...categoriesData.map(c => c.amount));

    container.innerHTML = categoriesData.map(category => `
    <div class="category-item">
      <div class="category-info">
        <p class="category-name">${category.category}</p>
        <div class="category-bar">
          <div class="category-progress" style="width: ${(category.amount / maxAmount) * 100}%"></div>
        </div>
      </div>
      <p class="category-amount">${formatCurrency(category.amount)}</p>
    </div>
  `).join('');
}

async function loadCards() {
    document.getElementById('myCards').innerHTML = getSkeletonHTML('card', 1);
    try {
        const response = await apiRequest(API_ENDPOINTS.cards);

        if (response.success) {
            cards = response.data;
            displayCards(cards);
        }
    } catch (error) {
        console.error('Error loading cards:', error);
    }
}

function displayCards(cardsData) {
    const container = document.getElementById('myCards');

    if (!cardsData || cardsData.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💳</div>
        <p>No cards added yet</p>
        <button class="btn btn-primary btn-sm" onclick="openCardModal()">Add Card</button>
      </div>
    `;
        return;
    }

    container.innerHTML = cardsData.slice(0, 3).map(card => `
    <div class="credit-card">
      <p class="card-type">${card.cardType || 'Card'}</p>
      <p class="card-number">${card.maskedNumber || maskCardNumber(card.cardNumber)}</p>
      <div class="card-details">
        <div class="card-holder">${card.cardHolderName}</div>
        <div class="card-balance">${formatCurrency(card.balance)}</div>
      </div>
    </div>
  `).join('');

    // Re-apply tilt handlers for dynamic card elements.
    setupCardTiltEffects();
}

// ===================================
// NAVIGATION
// ===================================

function setupEventListeners() {
    // Mobile menu toggle
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('show');
    });

    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateToPage(page);
        });
    });

    // Logout
    logoutBtn.addEventListener('click', logout);

    // Quick actions
    document.getElementById('addIncomeBtn').addEventListener('click', () => openTransactionModal('income'));
    document.getElementById('addExpenseBtn').addEventListener('click', () => openTransactionModal('expense'));
    document.getElementById('addCardBtn').addEventListener('click', openCardModal);
    document.getElementById('sendMoneyBtn').addEventListener('click', () => navigateToPage('transfer'));

    // Transaction modal
    document.getElementById('closeTransactionModal').addEventListener('click', closeTransactionModal);
    document.getElementById('cancelTransaction').addEventListener('click', closeTransactionModal);
    document.getElementById('transactionForm').addEventListener('submit', handleTransactionSubmit);
    document.getElementById('transactionType').addEventListener('change', updateCategoryOptions);

    // Card modal
    document.getElementById('closeCardModal').addEventListener('click', closeCardModal);
    document.getElementById('cancelCard').addEventListener('click', closeCardModal);
    document.getElementById('cardForm').addEventListener('submit', handleCardSubmit);

    // Card number formatting
    document.getElementById('cardNumber').addEventListener('input', formatCardNumberInput);
    document.getElementById('cardExpiry').addEventListener('input', formatExpiryInput);

    // Send money form
    document.getElementById('sendMoneyForm').addEventListener('submit', handleSendMoney);
    document.getElementById('recipientEmail').addEventListener('input', debounce(searchUsers, 300));

    // View all transactions
    document.getElementById('viewAllTransactions').addEventListener('click', () => navigateToPage('transactions'));
    document.getElementById('addTransactionBtn')?.addEventListener('click', () => openTransactionModal('expense'));

    // Recurring checkbox toggle
    document.getElementById('isRecurring').addEventListener('change', (e) => {
        document.getElementById('frequencyGroup').style.display = e.target.checked ? 'block' : 'none';
    });

    // Export Data
    document.getElementById('exportDataBtn')?.addEventListener('click', exportTransactions);

    // Filters
    document.getElementById('filterType')?.addEventListener('change', loadAllTransactions);
    document.getElementById('filterCategory')?.addEventListener('change', loadAllTransactions);
    document.getElementById('filterMonth')?.addEventListener('change', loadAllTransactions);
    document.getElementById('searchTransactions')?.addEventListener('input', debounce(loadAllTransactions, 300));

    // Keyboard Navigation for Modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (transactionModal.classList.contains('show')) closeTransactionModal();
            if (cardModal.classList.contains('show')) closeCardModal();
        }
    });

    // Keyboard Navigation for User Suggestions
    const userSuggestions = document.getElementById('userSuggestions');
    userSuggestions.addEventListener('keydown', (e) => {
        const items = Array.from(userSuggestions.querySelectorAll('.suggestion-item'));
        if (!items.length) return;
        
        const currentIndex = items.indexOf(document.activeElement);
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = (currentIndex + 1) % items.length;
            items[nextIndex].focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = (currentIndex - 1 + items.length) % items.length;
            items[prevIndex].focus();
        }
    });
}

async function navigateToPage(page) {
    if (isPageTransitioning || page === currentPage) return;
    isPageTransitioning = true;

    const currentSection = getSectionByPage(currentPage);
    const nextSection = getSectionByPage(page);

    if (currentSection && nextSection) {
        await animateSectionTransition(currentSection, nextSection);
    }

    currentPage = page;

    // Update active nav item
    navItems.forEach(item => {
        if (item.dataset.page === page) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    switch (page) {
        case 'dashboard':
            pageTitle.textContent = 'Dashboard';
            showOnlySection(dashboardContent);
            loadDashboardData();
            break;
        case 'transactions':
            pageTitle.textContent = 'Transactions';
            showOnlySection(transactionsContent);
            loadAllTransactions();
            break;
        case 'cards':
            pageTitle.textContent = 'My Cards';
            showOnlySection(cardsContent);
            loadAllCards();
            break;
        case 'analytics':
            pageTitle.textContent = 'Analytics';
            showOnlySection(analyticsContent);
            loadAnalytics();
            break;
        case 'transfer':
            pageTitle.textContent = 'Send Money';
            showOnlySection(transferContent);
            loadTransferHistory();
            break;
        case 'recurring':
            pageTitle.textContent = 'Recurring Schedules';
            showOnlySection(recurringContent);
            loadRecurringTransactions();
            break;
    }

    // Close mobile menu
    sidebar.classList.remove('show');
    isPageTransitioning = false;
}

function getSectionByPage(page) {
    switch (page) {
        case 'dashboard':
            return dashboardContent;
        case 'transactions':
            return transactionsContent;
        case 'cards':
            return cardsContent;
        case 'analytics':
            return analyticsContent;
        case 'transfer':
            return transferContent;
        case 'recurring':
            return recurringContent;
        default:
            return null;
    }
}

function showOnlySection(activeSection) {
    [dashboardContent, transactionsContent, cardsContent, analyticsContent, transferContent, recurringContent]
        .forEach(section => {
            if (section === activeSection) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        });
}

function animateSectionTransition(currentSection, nextSection) {
    return new Promise((resolve) => {
        if (currentSection === nextSection) {
            resolve();
            return;
        }

        currentSection.classList.remove('section-enter-active');
        currentSection.classList.add('section-exit-active');

        setTimeout(() => {
            currentSection.classList.remove('section-exit-active');
            currentSection.classList.add('hidden');
            nextSection.classList.remove('hidden');
            nextSection.classList.add('section-enter-active');

            setTimeout(() => {
                nextSection.classList.remove('section-enter-active');
                resolve();
            }, 460);
        }, 260);
    });
}

// ===================================
// TRANSACTION MODAL
// ===================================

function openTransactionModal(type = 'expense', transaction = null) {
    editingTransactionId = transaction ? transaction._id : null;

    const modalTitle = document.getElementById('transactionModalTitle');
    const form = document.getElementById('transactionForm');

    if (transaction) {
        modalTitle.textContent = 'Edit Transaction';
        document.getElementById('transactionId').value = transaction._id;
        document.getElementById('transactionType').value = transaction.type;
        document.getElementById('transactionAmount').value = transaction.amount;
        document.getElementById('transactionCategory').value = transaction.category;
        document.getElementById('transactionDescription').value = transaction.description || '';
        document.getElementById('transactionDate').value = formatDateForInput(transaction.date);
    } else {
        modalTitle.textContent = 'Add Transaction';
        form.reset();
        document.getElementById('transactionType').value = type;
        document.getElementById('transactionDate').value = formatDateForInput(new Date());
    }

    // Reset recurring fields
    document.getElementById('isRecurring').checked = false;
    document.getElementById('frequencyGroup').style.display = 'none';
    document.getElementById('recurringFrequency').value = 'monthly';

    // Disable recurring checkbox if editing (simpler UX for now)
    document.getElementById('isRecurring').disabled = !!transaction;

    updateCategoryOptions();
    transactionModal.classList.add('show');
    transactionModal.setAttribute('aria-hidden', 'false');
    // Focus first input
    setTimeout(() => document.getElementById('transactionAmount').focus(), 100);
}

function closeTransactionModal() {
    transactionModal.classList.remove('show');
    transactionModal.setAttribute('aria-hidden', 'true');
    document.getElementById('transactionForm').reset();
    editingTransactionId = null;
}

function updateCategoryOptions() {
    const type = document.getElementById('transactionType').value;
    const categorySelect = document.getElementById('transactionCategory');
    const categories = TRANSACTION_CATEGORIES[type] || [];

    categorySelect.innerHTML = '<option value="">Select category</option>' +
        categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
}

function populateCategoryOptions() {
    const filterCategory = document.getElementById('filterCategory');
    if (filterCategory) {
        const allCategories = [...TRANSACTION_CATEGORIES.income, ...TRANSACTION_CATEGORIES.expense];
        const uniqueCategories = [...new Set(allCategories)];

        filterCategory.innerHTML = '<option value="">All Categories</option>' +
            uniqueCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }
}

async function handleTransactionSubmit(e) {
    e.preventDefault();

    const submitButton = e.target.querySelector('button[type="submit"]');
    showLoading(submitButton);

    const formData = {
        type: document.getElementById('transactionType').value,
        amount: parseFloat(document.getElementById('transactionAmount').value),
        category: document.getElementById('transactionCategory').value,
        description: document.getElementById('transactionDescription').value,
        date: document.getElementById('transactionDate').value,
        isRecurring: document.getElementById('isRecurring').checked,
        recurringFrequency: document.getElementById('recurringFrequency').value,
    };

    try {
        let response;

        if (editingTransactionId) {
            response = await apiRequest(API_ENDPOINTS.transaction(editingTransactionId), {
                method: 'PUT',
                body: JSON.stringify(formData),
            });
        } else {
            response = await apiRequest(API_ENDPOINTS.transactions, {
                method: 'POST',
                body: JSON.stringify(formData),
            });
        }

        if (response.success) {
            showToast(editingTransactionId ? 'Transaction updated!' : 'Transaction added!', 'success');
            closeTransactionModal();
            loadDashboardData();
            if (currentPage === 'transactions') {
                loadAllTransactions();
            }
            if (currentPage === 'analytics') {
                loadAnalytics();
            }
            if (formData.isRecurring) {
                // If on recurring page, reload it
                if (currentPage === 'recurring') loadRecurringTransactions();
            }
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading(submitButton);
    }
}

// ===================================
// CARD MODAL
// ===================================

function openCardModal() {
    cardModal.classList.add('show');
    cardModal.setAttribute('aria-hidden', 'false');
    // Focus first input
    setTimeout(() => document.getElementById('cardNumber').focus(), 100);
}

function closeCardModal() {
    cardModal.classList.remove('show');
    cardModal.setAttribute('aria-hidden', 'true');
    document.getElementById('cardForm').reset();
}

function formatCardNumberInput(e) {
    let value = e.target.value.replace(/\s/g, '');
    let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
    e.target.value = formattedValue;
}

function formatExpiryInput(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 2) {
        value = value.slice(0, 2) + '/' + value.slice(2, 4);
    }
    e.target.value = value;
}

async function handleCardSubmit(e) {
    e.preventDefault();

    const submitButton = e.target.querySelector('button[type="submit"]');
    showLoading(submitButton);

    const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
    const cardHolderName = document.getElementById('cardHolderName').value.toUpperCase();
    const expiry = document.getElementById('cardExpiry').value;
    const cvv = document.getElementById('cardCVV').value;
    const balance = parseFloat(document.getElementById('cardBalance').value) || 0;

    // Validation
    if (!validateCardNumber(cardNumber)) {
        showToast('Invalid card number', 'error');
        hideLoading(submitButton);
        return;
    }

    if (!validateExpiry(expiry)) {
        showToast('Invalid expiry date (MM/YY)', 'error');
        hideLoading(submitButton);
        return;
    }

    if (!validateCVV(cvv)) {
        showToast('Invalid CVV', 'error');
        hideLoading(submitButton);
        return;
    }

    const formData = {
        cardNumber,
        cardHolderName,
        expiry,
        cvv,
        balance,
    };

    try {
        const response = await apiRequest(API_ENDPOINTS.cards, {
            method: 'POST',
            body: JSON.stringify(formData),
        });

        if (response.success) {
            showToast('Card added successfully!', 'success');
            closeCardModal();
            loadCards();
            if (currentPage === 'cards') {
                loadAllCards();
            }
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading(submitButton);
    }
}

// ===================================
// LOAD ALL TRANSACTIONS
// ===================================

async function loadAllTransactions() {
    const container = document.getElementById('allTransactions');
    container.innerHTML = getSkeletonHTML('list-item', 8);

    try {
        const type = document.getElementById('filterType')?.value || '';
        const category = document.getElementById('filterCategory')?.value || '';
        const month = document.getElementById('filterMonth')?.value || '';
        const search = document.getElementById('searchTransactions')?.value || '';

        let url = `${API_ENDPOINTS.transactions}?`;
        if (type) url += `type=${type}&`;
        if (category) url += `category=${category}&`;
        if (month) {
            const [year, monthNum] = month.split('-');
            url += `year=${year}&month=${monthNum}&`;
        }
        if (search) url += `search=${search}&`;

        const response = await apiRequest(url);

        if (response.success) {
            transactions = Array.isArray(response.data) ? response.data : [];
            displayAllTransactions(transactions);
        }
    } catch (error) {
        container.innerHTML = '<div class="empty-state"><p>Failed to load transactions</p></div>';
    }
}

function displayAllTransactions(transactionsData) {
    const container = document.getElementById('allTransactions');

    if (!transactionsData || transactionsData.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <p>No transactions found</p>
      </div>
    `;
        return;
    }

    container.innerHTML = `
    <div class="transactions-list">
      ${transactionsData.map(transaction => `
        <div class="transaction-item">
          <div class="transaction-icon ${transaction.type}">
            ${transaction.type === 'income' ? '📈' : '📉'}
          </div>
          <div class="transaction-details">
            <p class="transaction-category">${transaction.category}</p>
            <p class="transaction-description">${transaction.description || 'No description'}</p>
          </div>
          <div style="text-align: right;">
            <p class="transaction-amount ${transaction.type === 'income' ? 'text-success' : 'text-danger'}">
              ${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}
            </p>
            <p class="transaction-date">${formatDate(transaction.date)}</p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm btn-secondary" onclick='editTransaction(${JSON.stringify(transaction)})'>
              <span>Edit</span>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteTransaction(event, '${transaction._id}')">
              <span>Delete</span>
              <span class="btn-loader" style="display: none;"><span class="spinner"></span></span>
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ===================================
// EXPORT TRANSACTIONS
// ===================================

async function exportTransactions() {
    const btn = document.getElementById('exportDataBtn');
    if (!btn) return;
    
    const originalText = btn.textContent;
    btn.textContent = 'Exporting...';
    btn.disabled = true;

    try {
        const type = document.getElementById('filterType')?.value || '';
        const category = document.getElementById('filterCategory')?.value || '';
        const month = document.getElementById('filterMonth')?.value || '';
        const search = document.getElementById('searchTransactions')?.value || '';

        let url = `${API_ENDPOINTS.transactionsExport}?`;
        if (type) url += `type=${type}&`;
        if (category) url += `category=${category}&`;
        if (month) {
            const [year, monthNum] = month.split('-');
            url += `year=${year}&month=${monthNum}&`;
        }
        if (search) url += `search=${search}&`;

        const token = localStorage.getItem(STORAGE_KEYS.token);
        const requestHeaders = {
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(url, { headers: requestHeaders });

        if (!response.ok) {
            let errMessage = 'Export failed';
            try {
                const errData = await response.json();
                if (errData.message) errMessage = errData.message;
            } catch (e) {}
            throw new Error(errMessage);
        }

        const blob = await response.blob();
        if (blob.size === 0) throw new Error('No data found to export');
        
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = downloadUrl;
        a.download = 'transactions.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();
        
        showToast('Export successful!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function editTransaction(transaction) {
    openTransactionModal(transaction.type, transaction);
}

async function deleteTransaction(e, id) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    const btn = e.currentTarget;
    showLoading(btn);

    try {
        const response = await apiRequest(API_ENDPOINTS.transaction(id), {
            method: 'DELETE',
        });

        if (response.success) {
            showToast('Transaction deleted!', 'success');
            loadDashboardData();
            if (currentPage === 'transactions') {
                loadAllTransactions();
            }
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading(btn);
    }
}

// ===================================
// LOAD ALL CARDS
// ===================================

async function loadAllCards() {
    const container = document.getElementById('allCards');
    container.innerHTML = getSkeletonHTML('card', 2);

    try {
        const response = await apiRequest(API_ENDPOINTS.cards);

        if (response.success) {
            displayAllCards(response.data);
        }
    } catch (error) {
        container.innerHTML = '<div class="empty-state"><p>Failed to load cards</p></div>';
    }
}

function displayAllCards(cardsData) {
    const container = document.getElementById('allCards');

    if (!cardsData || cardsData.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💳</div>
        <p>No cards added yet</p>
        <button class="btn btn-primary" onclick="openCardModal()">Add Your First Card</button>
      </div>
    `;
        return;
    }

    container.innerHTML = cardsData.map(card => `
    <div class="credit-card">
      <p class="card-type">${card.cardType || 'Card'}</p>
      <p class="card-number">${card.maskedNumber || maskCardNumber(card.cardNumber)}</p>
      <div class="card-details">
        <div>
          <p style="font-size: 12px; color: var(--text-tertiary); margin: 0;">Card Holder</p>
          <p class="card-holder">${card.cardHolderName}</p>
        </div>
        <div>
          <p style="font-size: 12px; color: var(--text-tertiary); margin: 0;">Balance</p>
          <p class="card-balance">${formatCurrency(card.balance)}</p>
        </div>
      </div>
    </div>
  `).join('');

    // Re-apply tilt handlers for dynamic card elements.
    setupCardTiltEffects();
}

function animateCurrencyCounter(element, targetValue, duration = 700) {
    if (!element || typeof targetValue !== 'number' || Number.isNaN(targetValue)) return;

    const previousValue = parseFloat(element.dataset.value || '0');
    const startValue = Number.isNaN(previousValue) ? 0 : previousValue;
    const startTime = performance.now();

    const render = (timestamp) => {
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const next = startValue + (targetValue - startValue) * eased;
        element.textContent = formatCurrency(next);

        if (progress < 1) {
            requestAnimationFrame(render);
            return;
        }

        element.dataset.value = String(targetValue);
    };

    requestAnimationFrame(render);
}

function setupCardTiltEffects() {
    const tiltCards = document.querySelectorAll('.stat-card, .credit-card, .action-btn');
    tiltCards.forEach(card => {
        if (card.dataset.tiltBound === '1') return;

        card.dataset.tiltBound = '1';
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const rotateY = ((x / rect.width) - 0.5) * 7;
            const rotateX = (0.5 - (y / rect.height)) * 7;

            card.classList.add('tilt-active');
            card.style.transform = `perspective(700px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)`;
        });

        card.addEventListener('mouseleave', () => {
            card.classList.remove('tilt-active');
            card.style.transform = '';
        });
    });
}

function setupInteractiveMotion() {
    setupCardTiltEffects();
}

// ===================================
// ANALYTICS
// ===================================

let categoryChartInstance = null;
let monthlyChartInstance = null;
let trendChartInstance = null;
let overviewChartInstance = null;

// All raw expense + income data cached for client-side filtering
let allExpenseData = [];
let allIncomeData = [];

/**
 * Fetches ALL transactions of a given type by paginating through results.
 * The server enforces a max limit of 100 per request, so we loop until done.
 */
async function fetchAllTransactions(type) {
    const PAGE_SIZE = 100;
    let page = 1;
    let collected = [];
    let hasMore = true;

    while (hasMore) {
        try {
            const res = await apiRequest(
                `${API_ENDPOINTS.transactions}?type=${type}&limit=${PAGE_SIZE}&page=${page}&sort=-date`
            );
            if (!res.success || !res.data || res.data.length === 0) {
                hasMore = false;
            } else {
                collected = collected.concat(res.data);
                if (collected.length >= res.total || res.data.length < PAGE_SIZE) {
                    hasMore = false;
                } else {
                    page++;
                }
            }
        } catch {
            hasMore = false;
        }
    }
    return collected;
}

async function loadAnalytics() {
    // Show loading in chart areas
    const loaders = document.querySelectorAll('.chart-container .loading-state');
    loaders.forEach(l => l && l.classList.remove('hidden'));

    try {
        // Fetch ALL transactions using pagination (server enforces max limit=100)
        const [allExpenses, allIncomes] = await Promise.all([
            fetchAllTransactions('expense'),
            fetchAllTransactions('income')
        ]);

        allExpenseData = allExpenses.map(t => ({
            ...t,
            dateObj: new Date(t.date)
        })).sort((a, b) => a.dateObj - b.dateObj);

        allIncomeData = allIncomes.map(t => ({
            ...t,
            dateObj: new Date(t.date)
        })).sort((a, b) => a.dateObj - b.dateObj);

        populateAnalyticsCategoryFilter();

        // Bind filters (clone to remove old listeners)
        const dateRangeSelect = document.getElementById('analyticsDateRange');
        const categorySelect = document.getElementById('analyticsCategoryFilter');

        const newDateRangeSelect = dateRangeSelect.cloneNode(true);
        dateRangeSelect.parentNode.replaceChild(newDateRangeSelect, dateRangeSelect);

        const newCategorySelect = categorySelect.cloneNode(true);
        categorySelect.parentNode.replaceChild(newCategorySelect, categorySelect);

        newDateRangeSelect.addEventListener('change', updateAnalyticsView);
        newCategorySelect.addEventListener('change', updateAnalyticsView);

        // Bind export button
        const exportBtn = document.getElementById('exportChartsBtn');
        if (exportBtn) {
            exportBtn.onclick = exportChartsAsPNG;
        }

        updateAnalyticsView();
    } catch (error) {
        console.error('Failed to load analytics', error);
        showToast('Failed to load analytics data', 'error');
    }
}

function populateAnalyticsCategoryFilter() {
    const categories = [...new Set(allExpenseData.map(t => t.category))].sort();
    const select = document.getElementById('analyticsCategoryFilter');
    if (!select) return;
    const currValue = select.value;
    select.innerHTML = '<option value="all">All Categories</option>' +
        categories.map(c => `<option value="${c}">${escapeHTML(c)}</option>`).join('');
    if (categories.includes(currValue)) select.value = currValue;
}

function getDateCutoff(range, now) {
    if (range === 'all') return null;
    const days = parseInt(range);
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function filterByDateAndCategory(data, cutoff, category) {
    return data.filter(t => {
        const dateOk = !cutoff || t.dateObj >= cutoff;
        const catOk = category === 'all' || t.category === category;
        return dateOk && catOk;
    });
}

function updateAnalyticsView() {
    const range = document.getElementById('analyticsDateRange').value;
    const category = document.getElementById('analyticsCategoryFilter').value;
    const now = new Date();
    const cutoff = getDateCutoff(range, now);

    // Filter expenses & incomes
    const filteredExpenses = filterByDateAndCategory(allExpenseData, cutoff, category);
    const filteredIncomes = filterByDateAndCategory(allIncomeData, cutoff, 'all'); // income always "all categories"

    // ── KPI Stats ────────────────────────────────────────────────
    const totalExpense = filteredExpenses.reduce((s, t) => s + t.amount, 0);
    document.getElementById('analyticsTotalExpense').textContent = formatCurrency(totalExpense);
    document.getElementById('analyticsTxnCount').textContent = filteredExpenses.length;

    // Highest category
    const catMap = {};
    filteredExpenses.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
    let topCat = 'N/A', topVal = 0;
    for (const [cat, val] of Object.entries(catMap)) {
        if (val > topVal) { topVal = val; topCat = cat; }
    }
    document.getElementById('analyticsHighestCategory').textContent = topCat;

    // Average daily
    let daysDivisor = 1;
    if (range === 'all') {
        if (filteredExpenses.length > 0) {
            const diff = Math.abs(now - filteredExpenses[0].dateObj);
            daysDivisor = Math.max(1, Math.ceil(diff / 86400000));
        }
    } else {
        daysDivisor = parseInt(range);
    }
    document.getElementById('analyticsAvgDaily').textContent = formatCurrency(totalExpense / daysDivisor);

    // ── Draw all 4 charts ────────────────────────────────────────
    drawOverviewChart(filteredIncomes, filteredExpenses, range);
    drawCategoryChart(catMap);
    drawMonthlyChart(filteredExpenses);
    drawTrendChart(filteredExpenses, range);
}

// ── Shared chart defaults ────────────────────────────────────────────────
const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false, // we use custom legends mostly
            labels: { color: '#c2d2e8', font: { family: "'Manrope', sans-serif", size: 12 } }
        },
        tooltip: {
            backgroundColor: 'rgba(9, 20, 39, 0.96)',
            titleColor: '#f6fbff',
            bodyColor: '#c2d2e8',
            borderColor: 'rgba(170, 210, 255, 0.22)',
            borderWidth: 1,
            padding: 14,
            titleFont: { size: 13, weight: '700', family: "'Space Grotesk', sans-serif" },
            bodyFont: { size: 13, family: "'Manrope', sans-serif" },
            cornerRadius: 10,
            callbacks: {
                label: ctx => ` ${formatCurrency(ctx.parsed.y ?? ctx.parsed)}`
            }
        }
    }
};

const CHART_COLORS = [
    '#c2b2f6', '#25f2b5', '#ff5a7a', '#ffc247',
    '#33d4ff', '#f6b2c2', '#b2f6c2', '#4facfe',
    '#f6c2b2', '#b2e2f6'
];

// ── 1. Overview Chart: Income (line) + Expense (bar) per month ────────────
function drawOverviewChart(incomes, expenses, range) {
    const ctx = document.getElementById('overviewChart');
    const emptyEl = document.getElementById('overviewChartEmpty');
    if (!ctx) return;

    // Build month-keyed maps
    const incomeMap = {};
    const expenseMap = {};

    const addToMap = (map, items) => items.forEach(t => {
        const key = t.dateObj.toLocaleString('default', { month: 'short', year: '2-digit' });
        map[key] = (map[key] || 0) + t.amount;
    });
    addToMap(incomeMap, incomes);
    addToMap(expenseMap, expenses);

    // Build sorted label set
    const labelSet = new Set([...Object.keys(incomeMap), ...Object.keys(expenseMap)]);

    // For fixed ranges, populate all months in window
    if (range !== 'all') {
        const months = parseInt(range) > 60 ? 3 : (parseInt(range) > 14 ? 2 : 1);
        const now = new Date();
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
            labelSet.add(key);
        }
    }

    const labels = [...labelSet].sort((a, b) => {
        const pa = new Date('1 ' + a), pb = new Date('1 ' + b);
        return pa - pb;
    });

    if (labels.length === 0) {
        emptyEl.classList.remove('hidden');
        ctx.style.display = 'none';
        if (overviewChartInstance) { overviewChartInstance.destroy(); overviewChartInstance = null; }
        return;
    }
    emptyEl.classList.add('hidden');
    ctx.style.display = 'block';

    const incomeData = labels.map(l => incomeMap[l] || 0);
    const expenseData = labels.map(l => expenseMap[l] || 0);

    if (overviewChartInstance) overviewChartInstance.destroy();

    const chartCtx = ctx.getContext('2d');

    // Gradient fill for income line
    const incGrad = chartCtx.createLinearGradient(0, 0, 0, 340);
    incGrad.addColorStop(0, 'rgba(37, 242, 181, 0.30)');
    incGrad.addColorStop(1, 'rgba(37, 242, 181, 0.02)');

    overviewChartInstance = new Chart(chartCtx, {
        data: {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Expenses',
                    data: expenseData,
                    backgroundColor: 'rgba(194, 178, 246, 0.65)',
                    hoverBackgroundColor: 'rgba(194, 178, 246, 0.9)',
                    borderRadius: 7,
                    borderSkipped: false,
                    yAxisID: 'y'
                },
                {
                    type: 'line',
                    label: 'Income',
                    data: incomeData,
                    borderColor: '#25f2b5',
                    backgroundColor: incGrad,
                    fill: true,
                    tension: 0.45,
                    pointBackgroundColor: '#071226',
                    pointBorderColor: '#25f2b5',
                    pointBorderWidth: 2.5,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    borderWidth: 3,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            ...commonChartOptions,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                ...commonChartOptions.plugins,
                legend: { display: false },
                tooltip: {
                    ...commonChartOptions.plugins.tooltip,
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(170, 210, 255, 0.07)', drawBorder: false },
                    ticks: {
                        color: '#8ea2bf',
                        padding: 10,
                        callback: v => '$' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)
                    },
                    border: { display: false }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8ea2bf', padding: 8 },
                    border: { display: false }
                }
            }
        }
    });
}

// ── 2. Category Doughnut Chart ─────────────────────────────────────────────
function drawCategoryChart(catMap) {
    const ctx = document.getElementById('categoryChart');
    const emptyEl = document.getElementById('categoryChartEmpty');
    const badgesEl = document.getElementById('categoryBadges');
    if (!ctx) return;

    const keys = Object.keys(catMap);

    if (keys.length === 0) {
        emptyEl.classList.remove('hidden');
        ctx.style.display = 'none';
        if (badgesEl) badgesEl.innerHTML = '';
        if (categoryChartInstance) { categoryChartInstance.destroy(); categoryChartInstance = null; }
        return;
    }
    emptyEl.classList.add('hidden');
    ctx.style.display = 'block';

    if (categoryChartInstance) categoryChartInstance.destroy();

    const colors = keys.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
    const total = keys.reduce((s, k) => s + catMap[k], 0);

    categoryChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: keys,
            datasets: [{
                data: Object.values(catMap),
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 10,
                borderRadius: 4
            }]
        },
        options: {
            ...commonChartOptions,
            cutout: '70%',
            plugins: {
                ...commonChartOptions.plugins,
                tooltip: {
                    ...commonChartOptions.plugins.tooltip,
                    callbacks: {
                        label: ctx => {
                            const pct = ((ctx.parsed / total) * 100).toFixed(1);
                            return ` ${ctx.label}: ${formatCurrency(ctx.parsed)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });

    // Render category badges below chart
    if (badgesEl) {
        badgesEl.innerHTML = keys.map((cat, i) => {
            const pct = ((catMap[cat] / total) * 100).toFixed(1);
            return `
            <div class="cat-badge-item">
                <span class="cat-badge-dot" style="background:${colors[i]};"></span>
                <span class="cat-badge-name">${escapeHTML(cat)}</span>
                <span class="cat-badge-pct">${pct}%</span>
                <span class="cat-badge-val">${formatCurrency(catMap[cat])}</span>
            </div>`;
        }).join('');
    }
}

// ── 3. Monthly Bar Chart ───────────────────────────────────────────────────
function drawMonthlyChart(data) {
    const ctx = document.getElementById('monthlyChart');
    const emptyEl = document.getElementById('monthlyChartEmpty');
    if (!ctx) return;

    if (data.length === 0) {
        emptyEl.classList.remove('hidden');
        ctx.style.display = 'none';
        if (monthlyChartInstance) { monthlyChartInstance.destroy(); monthlyChartInstance = null; }
        return;
    }
    emptyEl.classList.add('hidden');
    ctx.style.display = 'block';

    const monthMap = {};
    data.forEach(t => {
        const m = t.dateObj.toLocaleString('default', { month: 'short', year: '2-digit' });
        monthMap[m] = (monthMap[m] || 0) + t.amount;
    });

    const labels = Object.keys(monthMap);
    const values = Object.values(monthMap);
    const maxVal = Math.max(...values);

    // Color bars by intensity
    const bgs = values.map(v => {
        const ratio = v / maxVal;
        return `rgba(194, 178, 246, ${0.4 + ratio * 0.55})`;
    });
    const hovers = values.map(v => {
        const ratio = v / maxVal;
        return `rgba(194, 178, 246, ${0.65 + ratio * 0.3})`;
    });

    if (monthlyChartInstance) monthlyChartInstance.destroy();

    monthlyChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Expenses',
                data: values,
                backgroundColor: bgs,
                hoverBackgroundColor: hovers,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            ...commonChartOptions,
            plugins: {
                ...commonChartOptions.plugins,
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(170, 210, 255, 0.07)', drawBorder: false },
                    ticks: {
                        color: '#8ea2bf', padding: 10,
                        callback: v => '$' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)
                    },
                    border: { display: false }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8ea2bf', padding: 8 },
                    border: { display: false }
                }
            }
        }
    });
}

// ── 4. Daily Trend Line Chart ──────────────────────────────────────────────
function drawTrendChart(data, range) {
    const ctx = document.getElementById('trendChart');
    const emptyEl = document.getElementById('trendChartEmpty');
    const badge = document.getElementById('trendTotalBadge');
    if (!ctx) return;

    if (data.length === 0) {
        emptyEl.classList.remove('hidden');
        ctx.style.display = 'none';
        if (badge) badge.textContent = '';
        if (trendChartInstance) { trendChartInstance.destroy(); trendChartInstance = null; }
        return;
    }
    emptyEl.classList.add('hidden');
    ctx.style.display = 'block';

    // Build day map
    const dayMap = {};
    data.forEach(t => {
        const key = t.dateObj.toLocaleDateString('default', { month: 'short', day: 'numeric' });
        dayMap[key] = (dayMap[key] || 0) + t.amount;
    });

    const labels = [];
    const points = [];

    if (range !== 'all') {
        const days = parseInt(range);
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
            labels.push(key);
            points.push(dayMap[key] || 0);
        }
    } else {
        // All-time: use unique days from data
        Object.keys(dayMap).forEach(k => { labels.push(k); points.push(dayMap[k]); });
    }

    const totalSpend = points.reduce((s, v) => s + v, 0);
    if (badge) {
        badge.textContent = `Total: ${formatCurrency(totalSpend)}`;
    }

    if (trendChartInstance) trendChartInstance.destroy();

    const chartCtx = ctx.getContext('2d');
    const grad = chartCtx.createLinearGradient(0, 0, 0, 300);
    grad.addColorStop(0, 'rgba(51, 212, 255, 0.35)');
    grad.addColorStop(1, 'rgba(51, 212, 255, 0.0)');

    trendChartInstance = new Chart(chartCtx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Daily Spending',
                data: points,
                borderColor: '#33d4ff',
                backgroundColor: grad,
                fill: true,
                tension: 0.42,
                pointBackgroundColor: '#071226',
                pointBorderColor: '#33d4ff',
                pointBorderWidth: 2.5,
                pointRadius: 4,
                pointHoverRadius: 7,
                borderWidth: 2.5
            }]
        },
        options: {
            ...commonChartOptions,
            plugins: {
                ...commonChartOptions.plugins,
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(170, 210, 255, 0.07)', drawBorder: false },
                    ticks: {
                        color: '#8ea2bf', padding: 10,
                        callback: v => '$' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)
                    },
                    border: { display: false }
                },
                x: {
                    grid: { display: false },
                    ticks: { maxTicksLimit: 14, color: '#8ea2bf', padding: 8 },
                    border: { display: false }
                }
            }
        }
    });
}

// ── Export all charts as a combined PNG ───────────────────────────────────
function exportChartsAsPNG() {
    const chartInstances = [
        { id: 'overviewChart', name: 'Overview' },
        { id: 'categoryChart', name: 'Category' },
        { id: 'monthlyChart', name: 'Monthly' },
        { id: 'trendChart', name: 'Trend' }
    ];

    // Export each chart individually
    let exported = 0;
    chartInstances.forEach(({ id, name }) => {
        const canvas = document.getElementById(id);
        if (!canvas || canvas.style.display === 'none') return;
        const link = document.createElement('a');
        link.download = `spendify-${name.toLowerCase()}-chart.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        exported++;
    });

    if (exported === 0) {
        showToast('No charts to export. Add some expenses first.', 'error');
    } else {
        showToast(`${exported} chart(s) exported successfully!`, 'success');
    }
}

// ===================================
// SEND MONEY
// ===================================

async function searchUsers(e) {
    const email = e.target.value.trim();
    const suggestions = document.getElementById('userSuggestions');

    if (email.length < 3) {
        suggestions.classList.remove('show');
        return;
    }

    suggestions.innerHTML = '<div class="suggestion-item"><div class="spinner" style="width: 14px; height: 14px; display: inline-block; margin-right: 8px;"></div> Searching...</div>';
    suggestions.classList.add('show');

    try {
        const response = await apiRequest(`${API_ENDPOINTS.transferSearch}?email=${email}`);

        if (response.success && response.data.length > 0) {
            suggestions.innerHTML = response.data.map(user => `
        <button type="button" class="suggestion-item" style="width:100%;text-align:left;border:none;background:none;font:inherit;color:inherit;" tabindex="0" onclick="selectUser('${user.email}', '${user.name}')" onkeydown="if(event.key==='Enter' || event.key===' ') {event.preventDefault(); selectUser('${user.email}', '${user.name}');}">
          <strong>${user.name}</strong><br>
          <small>${user.email}</small>
        </button>
      `).join('');
            suggestions.classList.add('show');
        } else {
            suggestions.classList.remove('show');
        }
    } catch (error) {
        console.error('Error searching users:', error);
    }
}

function selectUser(email, name) {
    document.getElementById('recipientEmail').value = email;
    document.getElementById('userSuggestions').classList.remove('show');
}

async function handleSendMoney(e) {
    e.preventDefault();

    const submitButton = e.target.querySelector('button[type="submit"]');
    showLoading(submitButton);

    const formData = {
        recipientEmail: document.getElementById('recipientEmail').value,
        amount: parseFloat(document.getElementById('transferAmount').value),
        description: document.getElementById('transferDescription').value,
    };

    try {
        const response = await apiRequest(API_ENDPOINTS.transferSend, {
            method: 'POST',
            body: JSON.stringify(formData),
        });

        if (response.success) {
            showToast('Money sent successfully!', 'success');
            document.getElementById('sendMoneyForm').reset();
            loadTransferHistory();
            loadDashboardData();
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading(submitButton);
    }
}

async function loadTransferHistory() {
    const container = document.getElementById('transferHistory');
    container.innerHTML = getSkeletonHTML('list-item', 5);

    try {
        const response = await apiRequest(API_ENDPOINTS.transferHistory);

        if (response.success) {
            displayTransferHistory(response.data);
        }
    } catch (error) {
        container.innerHTML = '<div class="empty-state"><p>Failed to load history</p></div>';
    }
}

function displayTransferHistory(transfersData) {
    const container = document.getElementById('transferHistory');

    if (!transfersData || transfersData.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔄</div>
        <p>No transfers yet</p>
      </div>
    `;
        return;
    }

    container.innerHTML = `
    <div class="transactions-list">
      ${transfersData.map(transfer => `
        <div class="transaction-item">
          <div class="transaction-icon ${transfer.type}">
            ${transfer.type === 'income' ? '📥' : '📤'}
          </div>
          <div class="transaction-details">
            <p class="transaction-category">${transfer.category}</p>
            <p class="transaction-description">${transfer.description}</p>
          </div>
          <div style="text-align: right;">
            <p class="transaction-amount ${transfer.type === 'income' ? 'text-success' : 'text-danger'}">
              ${transfer.type === 'income' ? '+' : '-'}${formatCurrency(transfer.amount)}
            </p>
            <p class="transaction-date">${formatDate(transfer.date)}</p>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ===================================
// RECURRING TRANSACTIONS
// ===================================

async function loadRecurringTransactions() {
    const container = document.getElementById('recurringTransactionsList');
    container.innerHTML = getSkeletonHTML('list-item', 5);

    try {
        const response = await apiRequest(API_ENDPOINTS.recurringTransactions);
        if (response.success) {
            displayRecurringTransactions(response.data);
        }
    } catch (error) {
        container.innerHTML = '<div class="empty-state"><p>Failed to load schedules</p></div>';
    }
}

function displayRecurringTransactions(data) {
    const container = document.getElementById('recurringTransactionsList');

    if (!data || data.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <p>No recurring schedules yet</p>
      </div>
    `;
        return;
    }

    container.innerHTML = `
    <div class="transactions-list">
      ${data.map(item => `
        <div class="transaction-item">
          <div class="transaction-icon ${item.type}">
            🔄
          </div>
          <div class="transaction-details">
            <p class="transaction-category">${item.category} (${item.frequency})</p>
            <p class="transaction-description">${item.description || 'No description'}</p>
            <p class="transaction-date" style="font-size: 11px;">Next: ${formatDate(item.nextProcessingDate)}</p>
          </div>
          <div style="text-align: right; display: flex; align-items: center; gap: 15px;">
            <p class="transaction-amount ${item.type === 'income' ? 'text-success' : 'text-danger'}">
              ${item.type === 'income' ? '+' : '-'}${formatCurrency(item.amount)}
            </p>
            <button class="btn btn-sm btn-danger" onclick="deleteRecurring(event, '${item._id}')">
              <span>Cancel</span>
              <span class="btn-loader" style="display: none;"><span class="spinner"></span></span>
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function deleteRecurring(e, id) {
    if (!confirm('Are you sure you want to cancel this recurring schedule?')) return;
    const btn = e.currentTarget;
    showLoading(btn);

    try {
        const response = await apiRequest(API_ENDPOINTS.recurringTransaction(id), {
            method: 'DELETE',
        });
        if (response.success) {
            showToast('Schedule cancelled!', 'success');
            loadRecurringTransactions();
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading(btn);
    }
}

// Make functions globally accessible
window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;
window.deleteRecurring = deleteRecurring;
window.openCardModal = openCardModal;
window.selectUser = selectUser;

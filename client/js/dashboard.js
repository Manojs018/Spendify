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
    try {
        const response = await apiRequest(API_ENDPOINTS.analyticsSummary);

        if (response.success) {
            const data = response.data;

            // Update stats cards
            document.getElementById('totalBalance').textContent = formatCurrency(data.balance);
            document.getElementById('monthlyIncome').textContent = formatCurrency(data.monthly.income);
            document.getElementById('monthlyExpense').textContent = formatCurrency(data.monthly.expense);
            document.getElementById('monthlyBalance').textContent = formatCurrency(data.monthly.balance);

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

    // Filters
    document.getElementById('filterType')?.addEventListener('change', loadAllTransactions);
    document.getElementById('filterCategory')?.addEventListener('change', loadAllTransactions);
    document.getElementById('filterMonth')?.addEventListener('change', loadAllTransactions);
    document.getElementById('searchTransactions')?.addEventListener('input', debounce(loadAllTransactions, 300));
}

function navigateToPage(page) {
    currentPage = page;

    // Update active nav item
    navItems.forEach(item => {
        if (item.dataset.page === page) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Hide all content sections
    dashboardContent.classList.add('hidden');
    transactionsContent.classList.add('hidden');
    cardsContent.classList.add('hidden');
    analyticsContent.classList.add('hidden');
    transferContent.classList.add('hidden');

    // Show selected content
    switch (page) {
        case 'dashboard':
            pageTitle.textContent = 'Dashboard';
            dashboardContent.classList.remove('hidden');
            loadDashboardData();
            break;
        case 'transactions':
            pageTitle.textContent = 'Transactions';
            transactionsContent.classList.remove('hidden');
            loadAllTransactions();
            break;
        case 'cards':
            pageTitle.textContent = 'My Cards';
            cardsContent.classList.remove('hidden');
            loadAllCards();
            break;
        case 'analytics':
            pageTitle.textContent = 'Analytics';
            analyticsContent.classList.remove('hidden');
            loadAnalytics();
            break;
        case 'transfer':
            pageTitle.textContent = 'Send Money';
            transferContent.classList.remove('hidden');
            loadTransferHistory();
            break;
    }

    // Close mobile menu
    sidebar.classList.remove('show');
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

    updateCategoryOptions();
    transactionModal.classList.add('show');
}

function closeTransactionModal() {
    transactionModal.classList.remove('show');
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
}

function closeCardModal() {
    cardModal.classList.remove('show');
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
    container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';

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
            transactions = response.data;
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
            <button class="btn btn-sm btn-secondary" onclick='editTransaction(${JSON.stringify(transaction)})'>Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteTransaction('${transaction._id}')">Delete</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function editTransaction(transaction) {
    openTransactionModal(transaction.type, transaction);
}

async function deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

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
    }
}

// ===================================
// LOAD ALL CARDS
// ===================================

async function loadAllCards() {
    const container = document.getElementById('allCards');
    container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';

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
}

// ===================================
// ANALYTICS
// ===================================

async function loadAnalytics() {
    const container = document.getElementById('analyticsCharts');
    container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading analytics...</p></div>';

    try {
        const response = await apiRequest(API_ENDPOINTS.analyticsTrends);

        if (response.success) {
            displayAnalytics(response.data);
        }
    } catch (error) {
        container.innerHTML = '<div class="empty-state"><p>Failed to load analytics</p></div>';
    }
}

function displayAnalytics(trendsData) {
    const container = document.getElementById('analyticsCharts');

    container.innerHTML = `
    <div style="padding: var(--space-lg);">
      <h4>6-Month Spending Trend</h4>
      <div style="display: flex; flex-direction: column; gap: var(--space-md); margin-top: var(--space-lg);">
        ${trendsData.map(month => `
          <div>
            <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-xs);">
              <span>${month.monthName} ${month.year}</span>
              <span class="text-danger">${formatCurrency(month.expense)}</span>
            </div>
            <div class="category-bar">
              <div class="category-progress" style="width: ${(month.expense / Math.max(...trendsData.map(m => m.expense))) * 100}%"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
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

    try {
        const response = await apiRequest(`${API_ENDPOINTS.transferSearch}?email=${email}`);

        if (response.success && response.data.length > 0) {
            suggestions.innerHTML = response.data.map(user => `
        <div class="suggestion-item" onclick="selectUser('${user.email}', '${user.name}')">
          <strong>${user.name}</strong><br>
          <small>${user.email}</small>
        </div>
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
    container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';

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

// Make functions globally accessible
window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;
window.openCardModal = openCardModal;
window.selectUser = selectUser;

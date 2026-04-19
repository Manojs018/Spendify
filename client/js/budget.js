// ===================================
// BUDGET LIMITS & ALERTS MODULE
// Spendify — Production-ready, modular
// ===================================

// ── State ────────────────────────────────────────────────────────────────────
let budgetState = {
    monthKey: '',           // YYYY-MM
    overallLimit: 0,
    alertThreshold: 80,
    categoryLimits: [],     // [{ category, limit }]
    totalSpent: 0,
    categorySpending: {},   // { catName: amount }
    categoryRows: [],       // dynamic UI rows
    dismissedAlerts: new Set(), // keys of already-dismissed toasts
};

// Expense categories from config.js
const EXPENSE_CATEGORIES = (typeof TRANSACTION_CATEGORIES !== 'undefined')
    ? TRANSACTION_CATEGORIES.expense
    : ['Food & Dining', 'Shopping', 'Transportation', 'Bills & Utilities',
       'Entertainment', 'Healthcare', 'Education', 'Travel', 'Other Expense'];

// ── Helpers ───────────────────────────────────────────────────────────────────
const currentMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (key) => {
    const [y, m] = key.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, 1)
        .toLocaleString('default', { month: 'long', year: 'numeric' });
};

const pct = (spent, limit) => (limit > 0 ? Math.min((spent / limit) * 100, 100) : 0);

const fmt = (n) => (typeof formatCurrency === 'function' ? formatCurrency(n) : `$${n.toFixed(2)}`);

const statusClass = (p, threshold) => {
    if (p >= 100) return 'budget-exceeded';
    if (p >= threshold) return 'budget-warning';
    return 'budget-safe';
};

const statusIcon = (p, threshold) => {
    if (p >= 100) return '🚨';
    if (p >= threshold) return '⚠️';
    return '✅';
};

// ── API ───────────────────────────────────────────────────────────────────────
async function fetchBudgetData(monthKey) {
    try {
        return await apiRequest(`${API_ENDPOINTS.budgets}?month=${monthKey}`);
    } catch (e) {
        console.error('Budget fetch error:', e);
        return null;
    }
}

async function saveBudgetToServer(payload) {
    return apiRequest(API_ENDPOINTS.budgets, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

// ── Load & Render ─────────────────────────────────────────────────────────────
async function loadBudgetPage() {
    budgetState.monthKey = currentMonthKey();
    populateMonthSelector();

    const res = await fetchBudgetData(budgetState.monthKey);
    if (res && res.success) mergeBudgetState(res.data);

    renderBudgetPage();
    checkAndFireAlerts(false); // silent on first load (no toasts)
}

function mergeBudgetState(data) {
    budgetState.overallLimit = data.overallLimit ?? 0;
    budgetState.alertThreshold = data.alertThreshold ?? 80;
    budgetState.categoryLimits = data.categoryLimits ?? [];
    budgetState.totalSpent = data.totalSpent ?? 0;
    budgetState.categorySpending = data.categorySpending ?? {};
}

function populateMonthSelector() {
    const sel = document.getElementById('budgetMonthSelect');
    if (!sel) return;
    sel.innerHTML = '';
    // Last 6 months + next month
    const months = [];
    const now = new Date();
    for (let i = 5; i >= -1; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.push({ key, label: monthLabel(key) });
    }
    months.forEach(({ key, label }) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = label;
        if (key === budgetState.monthKey) opt.selected = true;
        sel.appendChild(opt);
    });
    sel.addEventListener('change', async (e) => {
        budgetState.monthKey = e.target.value;
        budgetState.dismissedAlerts.clear();
        const res = await fetchBudgetData(budgetState.monthKey);
        if (res && res.success) mergeBudgetState(res.data);
        else {
            // No budget for this month
            budgetState.overallLimit = 0;
            budgetState.alertThreshold = 80;
            budgetState.categoryLimits = [];
            budgetState.totalSpent = 0;
            budgetState.categorySpending = {};
        }
        renderBudgetPage();
    });
}

// ── Full Page Render ─────────────────────────────────────────────────────────
function renderBudgetPage() {
    renderOverallCard();
    renderCategoryLimitRows();
    renderBudgetSummaryCards();
    syncFormValues();
}

// ── Overall Budget Card ───────────────────────────────────────────────────────
function renderOverallCard() {
    const spent = budgetState.totalSpent;
    const limit = budgetState.overallLimit;
    const p = pct(spent, limit);
    const threshold = budgetState.alertThreshold;

    // Progress bar
    const bar = document.getElementById('overallProgressBar');
    const pctLabel = document.getElementById('overallProgressPct');
    const statusEl = document.getElementById('overallStatusBadge');
    const spentEl = document.getElementById('overallSpentAmt');
    const limitEl = document.getElementById('overallLimitAmt');
    const remEl = document.getElementById('overallRemainingAmt');
    const msgEl = document.getElementById('overallAlertMsg');

    if (!bar) return;

    bar.style.width = `${p}%`;
    bar.className = `budget-progress-fill ${statusClass(p, threshold)}`;
    if (pctLabel) pctLabel.textContent = `${p.toFixed(1)}%`;
    if (spentEl) spentEl.textContent = fmt(spent);
    if (limitEl) limitEl.textContent = limit > 0 ? fmt(limit) : 'Not Set';

    if (remEl) {
        const remaining = Math.max(limit - spent, 0);
        remEl.textContent = limit > 0 ? fmt(remaining) : '—';
        remEl.className = (limit > 0 && spent > limit) ? 'budget-overage' : '';
    }

    if (statusEl) {
        if (limit === 0) {
            statusEl.textContent = '— No Limit Set';
            statusEl.className = 'budget-badge budget-badge-neutral';
        } else if (p >= 100) {
            statusEl.textContent = '🚨 Exceeded';
            statusEl.className = 'budget-badge budget-badge-danger';
        } else if (p >= threshold) {
            statusEl.textContent = `⚠️ ${p.toFixed(0)}% Used`;
            statusEl.className = 'budget-badge budget-badge-warning';
        } else {
            statusEl.textContent = `✅ ${p.toFixed(0)}% Used`;
            statusEl.className = 'budget-badge budget-badge-safe';
        }
    }

    if (msgEl) {
        if (limit === 0) {
            msgEl.className = 'budget-alert-msg hidden';
        } else if (p >= 100) {
            msgEl.textContent = `🚨 You have exceeded your overall budget by ${fmt(spent - limit)}!`;
            msgEl.className = 'budget-alert-msg budget-alert-danger';
        } else if (p >= threshold) {
            msgEl.textContent = `⚠️ You've used ${p.toFixed(0)}% of your overall budget. Only ${fmt(limit - spent)} remaining.`;
            msgEl.className = 'budget-alert-msg budget-alert-warning';
        } else {
            msgEl.className = 'budget-alert-msg hidden';
        }
    }
}

// ── Summary Cards (3 KPI tiles at top) ───────────────────────────────────────
function renderBudgetSummaryCards() {
    const el = (id) => document.getElementById(id);

    // Count categories with active limits
    const catsWithLimit = budgetState.categoryLimits.filter(cl => cl.limit > 0).length;
    // Count exceeded
    const catsExceeded = budgetState.categoryLimits.filter(cl => {
        const spent = budgetState.categorySpending[cl.category] || 0;
        return cl.limit > 0 && spent >= cl.limit;
    }).length;
    // Highest cat spend
    const catEntries = Object.entries(budgetState.categorySpending);
    let topCat = '—', topAmt = 0;
    catEntries.forEach(([cat, amt]) => { if (amt > topAmt) { topAmt = amt; topCat = cat; } });

    if (el('budgetTotalSpent')) el('budgetTotalSpent').textContent = fmt(budgetState.totalSpent);
    if (el('budgetCatsTracked')) el('budgetCatsTracked').textContent = catsWithLimit;
    if (el('budgetCatsExceeded')) {
        el('budgetCatsExceeded').textContent = catsExceeded;
        el('budgetCatsExceeded').className = catsExceeded > 0 ? 'kpi-value text-danger' : 'kpi-value';
    }
    if (el('budgetTopCat')) el('budgetTopCat').textContent = topCat;
}

// ── Category Limit Rows ───────────────────────────────────────────────────────
function renderCategoryLimitRows() {
    const container = document.getElementById('categoryBudgetList');
    if (!container) return;

    const threshold = budgetState.alertThreshold;

    // Merge categories: those with a set limit + any we spent in
    const allCats = new Set([
        ...budgetState.categoryLimits.map(cl => cl.category),
        ...Object.keys(budgetState.categorySpending),
    ]);

    if (allCats.size === 0) {
        container.innerHTML = `
        <div class="budget-empty-state">
            <div class="budget-empty-icon">💰</div>
            <p>No category budgets set yet.</p>
            <p class="budget-empty-sub">Use "Set / Edit Budget" to define limits.</p>
        </div>`;
        return;
    }

    container.innerHTML = [...allCats].map(cat => {
        const limitObj = budgetState.categoryLimits.find(cl => cl.category === cat);
        const limit = limitObj ? limitObj.limit : 0;
        const spent = budgetState.categorySpending[cat] || 0;
        const p = pct(spent, limit);
        const sc = statusClass(p, threshold);
        const si = statusIcon(p, threshold);

        return `
        <div class="cat-budget-row ${sc}" data-category="${escapeHTML(cat)}">
            <div class="cat-budget-row-top">
                <span class="cat-budget-name">${escapeHTML(cat)}</span>
                <span class="cat-budget-badge ${sc}">${si} ${limit > 0 ? `${p.toFixed(0)}%` : 'No Limit'}</span>
            </div>
            <div class="cat-budget-meta">
                <span>Spent: <strong class="${sc === 'budget-exceeded' ? 'text-danger' : ''}">${fmt(spent)}</strong></span>
                <span>Limit: <strong>${limit > 0 ? fmt(limit) : '—'}</strong></span>
                <span class="${spent > limit && limit > 0 ? 'text-danger' : 'text-success'}">
                    Left: <strong>${limit > 0 ? fmt(Math.max(limit - spent, 0)) : '—'}</strong>
                </span>
            </div>
            ${limit > 0 ? `
            <div class="budget-progress-track" aria-label="${cat} budget: ${p.toFixed(0)}% used" role="progressbar">
                <div class="budget-progress-fill ${sc}" style="width: ${p}%;"></div>
            </div>` : ''}
            ${limit > 0 && p >= 100 ? `
            <div class="cat-budget-alert budget-alert-danger">
                🚨 Budget exceeded! Over by ${fmt(spent - limit)}.
            </div>` : ''}
            ${limit > 0 && p >= threshold && p < 100 ? `
            <div class="cat-budget-alert budget-alert-warning">
                ⚠️ ${p.toFixed(0)}% used — only ${fmt(limit - spent)} left.
            </div>` : ''}
        </div>`;
    }).join('');
}

// ── Form State Sync ───────────────────────────────────────────────────────────
function syncFormValues() {
    const overallInput = document.getElementById('overallLimitInput');
    const thresholdInput = document.getElementById('alertThresholdInput');
    if (overallInput && budgetState.overallLimit > 0)
        overallInput.value = budgetState.overallLimit;
    if (thresholdInput)
        thresholdInput.value = budgetState.alertThreshold;

    renderCategoryFormRows();
}

function renderCategoryFormRows() {
    const container = document.getElementById('categoryLimitInputs');
    if (!container) return;

    container.innerHTML = EXPENSE_CATEGORIES.map(cat => {
        const existing = budgetState.categoryLimits.find(cl => cl.category === cat);
        const val = existing ? existing.limit : '';
        return `
        <div class="cat-limit-input-row">
            <label class="cat-limit-label">${escapeHTML(cat)}</label>
            <input
                type="number"
                class="form-control cat-limit-input"
                data-category="${escapeHTML(cat)}"
                placeholder="No limit"
                value="${val}"
                min="0"
                step="0.01"
                aria-label="${escapeHTML(cat)} budget limit"
            />
        </div>`;
    }).join('');
}

// ── Save Budget ───────────────────────────────────────────────────────────────
async function handleSaveBudget(e) {
    e.preventDefault();
    const btn = document.getElementById('saveBudgetBtn');
    if (btn) showLoading(btn);

    const overallLimit = parseFloat(document.getElementById('overallLimitInput').value) || 0;
    const alertThreshold = parseInt(document.getElementById('alertThresholdInput').value) || 80;

    // Collect category limits from the input rows
    const catInputs = document.querySelectorAll('.cat-limit-input');
    const categoryLimits = [];
    catInputs.forEach(inp => {
        const val = parseFloat(inp.value);
        if (!isNaN(val) && val >= 0 && inp.value.trim() !== '') {
            categoryLimits.push({ category: inp.dataset.category, limit: val });
        }
    });

    try {
        const res = await saveBudgetToServer({
            month: budgetState.monthKey,
            overallLimit,
            alertThreshold,
            categoryLimits,
        });

        if (res.success) {
            showToast('Budget saved successfully! 🎯', 'success');
            // Reload to get fresh spending data
            const fresh = await fetchBudgetData(budgetState.monthKey);
            if (fresh && fresh.success) mergeBudgetState(fresh.data);
            budgetState.dismissedAlerts.clear();
            renderBudgetPage();
            checkAndFireAlerts(true);
            // Collapse form panel
            const formPanel = document.getElementById('budgetFormPanel');
            if (formPanel) formPanel.classList.add('collapsed');
        } else {
            showToast(res.message || 'Failed to save budget', 'error');
        }
    } catch (err) {
        showToast(err.message || 'Error saving budget', 'error');
    } finally {
        if (btn) hideLoading(btn);
    }
}

// ── Alerts Engine ─────────────────────────────────────────────────────────────
/**
 * Fires toast notifications for budget breaches.
 * @param {boolean} showToasts - true when called after saving/updating data
 */
function checkAndFireAlerts(showToasts = true) {
    if (!showToasts) return; // no toasts on initial silent load

    const threshold = budgetState.alertThreshold;

    // ── Overall budget alert ──────────────────────────────────────────
    if (budgetState.overallLimit > 0) {
        const p = pct(budgetState.totalSpent, budgetState.overallLimit);
        const alertKey = `overall-${p >= 100 ? 'exceeded' : 'warning'}`;

        if (p >= 100 && !budgetState.dismissedAlerts.has('overall-exceeded')) {
            showBudgetToast(
                `🚨 Monthly budget exceeded! You spent ${fmt(budgetState.totalSpent)} vs ${fmt(budgetState.overallLimit)} limit.`,
                'error'
            );
            budgetState.dismissedAlerts.add('overall-exceeded');
        } else if (p >= threshold && p < 100 && !budgetState.dismissedAlerts.has('overall-warning')) {
            showBudgetToast(
                `⚠️ You've used ${p.toFixed(0)}% of your monthly budget. Only ${fmt(budgetState.overallLimit - budgetState.totalSpent)} remaining.`,
                'warning'
            );
            budgetState.dismissedAlerts.add('overall-warning');
        }
    }

    // ── Category alerts ───────────────────────────────────────────────
    budgetState.categoryLimits.forEach(cl => {
        if (cl.limit <= 0) return;
        const spent = budgetState.categorySpending[cl.category] || 0;
        const p = pct(spent, cl.limit);

        if (p >= 100 && !budgetState.dismissedAlerts.has(`cat-${cl.category}-exceeded`)) {
            showBudgetToast(
                `🚨 Budget exceeded for <strong>${escapeHTML(cl.category)}</strong>! Spent ${fmt(spent)} vs ${fmt(cl.limit)} limit.`,
                'error'
            );
            budgetState.dismissedAlerts.add(`cat-${cl.category}-exceeded`);
        } else if (p >= threshold && p < 100 && !budgetState.dismissedAlerts.has(`cat-${cl.category}-warning`)) {
            showBudgetToast(
                `⚠️ You've used ${p.toFixed(0)}% of your <strong>${escapeHTML(cl.category)}</strong> budget.`,
                'warning'
            );
            budgetState.dismissedAlerts.add(`cat-${cl.category}-warning`);
        }
    });
}

/** Extended showToast that accepts HTML + a longer duration for budgets */
function showBudgetToast(htmlMsg, type = 'info') {
    if (typeof showToast === 'function') {
        // Strip HTML tags for basic toast
        const plain = htmlMsg.replace(/<[^>]+>/g, '');
        showToast(plain, type);
    }
}

// ── Called from dashboard.js after ANY transaction mutation ──────────────────
/**
 * Refreshes spending totals and re-evaluates alerts.
 * Hook this into createTransaction / deleteTransaction / editTransaction success.
 */
async function refreshBudgetAfterTransaction() {
    if (!budgetState.monthKey) return; // budgets page not loaded yet
    const res = await fetchBudgetData(budgetState.monthKey);
    if (res && res.success) {
        mergeBudgetState(res.data);
        // Only re-render if budget page is currently visible
        const budgetContent = document.getElementById('budgetContent');
        if (budgetContent && !budgetContent.classList.contains('hidden')) {
            renderBudgetPage();
        }
        checkAndFireAlerts(true);
    }
}

// ── Toggle form panel ────────────────────────────────────────────────────────
function toggleBudgetForm() {
    const formPanel = document.getElementById('budgetFormPanel');
    if (!formPanel) return;
    formPanel.classList.toggle('collapsed');
    if (!formPanel.classList.contains('collapsed')) {
        syncFormValues(); // refresh form with latest values
    }
}

// Expose to global scope (used by dashboard.js + inline HTML)
window.loadBudgetPage = loadBudgetPage;
window.handleSaveBudget = handleSaveBudget;
window.toggleBudgetForm = toggleBudgetForm;
window.refreshBudgetAfterTransaction = refreshBudgetAfterTransaction;

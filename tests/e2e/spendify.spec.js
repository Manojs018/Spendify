import { test, expect } from '@playwright/test';

const API_BASE_URL = 'http://localhost:5000/api';
const TEST_BYPASS_SECRET = 'spendify-dev-test-bypass';

async function registerAndLogin(request) {
  const timestamp = Date.now();
  const email = `playwright_${timestamp}@example.com`;
  const password = 'StrongPass!123';
  const headers = {
    'x-test-bypass': TEST_BYPASS_SECRET,
    'Content-Type': 'application/json',
  };

  const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
    data: { name: 'Playwright QA', email, password },
    headers,
  });
  expect(registerResponse.ok()).toBeTruthy();

  const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { email, password },
    headers,
  });
  expect(loginResponse.ok()).toBeTruthy();

  const loginBody = await loginResponse.json();
  return {
    email,
    password,
    token: loginBody.data.token,
    user: loginBody.data.user,
  };
}

async function seedTransaction(request, token, overrides = {}) {
  const response = await request.post(`${API_BASE_URL}/transactions`, {
    data: {
      type: 'expense',
      amount: 99.99,
      category: 'Food & Dining',
      description: 'Seed transaction',
      date: '2026-04-11',
      ...overrides,
    },
    headers: {
      Authorization: `Bearer ${token}`,
      'x-test-bypass': TEST_BYPASS_SECRET,
    },
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.data;
}

async function seedIncome(request, token, amount = 1000) {
  const response = await request.post(`${API_BASE_URL}/transactions`, {
    data: {
      type: 'income',
      amount,
      category: 'Salary',
      description: 'Funding income',
      date: '2026-04-11',
    },
    headers: {
      Authorization: `Bearer ${token}`,
      'x-test-bypass': TEST_BYPASS_SECRET,
    },
  });

  expect(response.ok()).toBeTruthy();
}

async function authenticatePage(page, session) {
  await page.addInitScript(
    ([token, user]) => {
      localStorage.setItem('spendify_token', token);
      localStorage.setItem('spendify_user', JSON.stringify(user));
    },
    [session.token, session.user]
  );
}

async function openDashboard(page) {
  await page.goto('/');

  const dashboardLink = page.getByRole('link', { name: /Go to Dashboard/i });
  if (await dashboardLink.isVisible()) {
    await dashboardLink.click();
  } else {
    await page.goto('/dashboard.html');
  }

  await expect(page.locator('#pageTitle')).toHaveText('Dashboard');
}

test.describe('Spendify expense flows', () => {
  test('E2E: user can add an expense from the dashboard quick action', async ({ page, request }) => {
    const session = await registerAndLogin(request);
    await seedIncome(request, session.token, 500);
    await authenticatePage(page, session);

    await openDashboard(page);
    await page.getByRole('button', { name: 'Add Expense' }).click();
    await page.locator('#transactionAmount').fill('120.50');
    await page.locator('#transactionCategory').selectOption('Food & Dining');
    await page.locator('#transactionDescription').fill('Playwright lunch');
    await page.locator('#transactionDate').fill('2026-04-11');
    await page.getByRole('button', { name: 'Save Transaction' }).click();

    await expect(page.locator('#toast')).toContainText('Transaction added!');
    await expect(page.locator('#recentTransactions')).toContainText('Playwright lunch');
    await expect(page.locator('#recentTransactions')).toContainText('$120.50');
  });

  test('E2E: user can edit an existing expense from the transactions page', async ({ page, request }) => {
    const session = await registerAndLogin(request);
    await seedIncome(request, session.token, 500);
    await seedTransaction(request, session.token, {
      amount: 40,
      category: 'Travel',
      description: 'Original cab fare',
    });
    await authenticatePage(page, session);

    await openDashboard(page);
    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('button', { name: /^Edit$/ }).first().click();
    await page.locator('#transactionAmount').fill('55.25');
    await page.locator('#transactionCategory').selectOption('Food & Dining');
    await page.locator('#transactionDescription').fill('Updated meal expense');
    await page.getByRole('button', { name: 'Save Transaction' }).click();

    await expect(page.locator('#toast')).toContainText('Transaction updated!');
    await expect(page.locator('#allTransactions')).toContainText('Updated meal expense');
    await expect(page.locator('#allTransactions')).toContainText('$55.25');
  });

  test('E2E: user can delete an existing expense from the transactions page', async ({ page, request }) => {
    const session = await registerAndLogin(request);
    await seedIncome(request, session.token, 500);
    await seedTransaction(request, session.token, {
      amount: 20,
      category: 'Shopping',
      description: 'Delete me',
    });
    await authenticatePage(page, session);

    await openDashboard(page);
    await page.getByRole('link', { name: 'Transactions' }).click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: /^Delete$/ }).first().click();

    await expect(page.locator('#toast')).toContainText('Transaction deleted!');
    await expect(page.locator('#allTransactions')).not.toContainText('Delete me');
  });
});

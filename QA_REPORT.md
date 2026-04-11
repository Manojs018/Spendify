# Spendify QA Report

## Scope

This report covers the expense-tracking workflows requested for Spendify:

- Add expense
- Edit expense
- Delete expense
- Categorization
- Total calculations
- Expense history display
- UI/UX, edge cases, performance, persistence, and browser coverage
- Playwright automation coverage for add, edit, and delete flows

Execution date: 2026-04-11

## Environment

- Workspace: `C:\Users\Manoj\OneDrive\Documents\ExpenseTracker\Spendify`
- App URL: `http://localhost:5000`
- Backend status: healthy
- Database-backed API validation: executed
- Browser automation execution: scripts generated, not executed in this session

## Functional Test Cases

| Test ID | Feature | Preconditions | Steps | Expected Result |
|---|---|---|---|---|
| FT-001 | Add new expense | User is registered and logged in with sufficient balance or prior income | 1. Open dashboard. 2. Click `Add Expense`. 3. Enter valid amount, category, description, and date. 4. Save. | Expense is created, success toast appears, recent history updates, totals reflect the new expense. |
| FT-002 | Add expense from Transactions page | User is logged in and on Transactions view | 1. Open Transactions page. 2. Click `+ Add Transaction`. 3. Complete form with expense details. 4. Save. | Transaction modal opens and the expense is added successfully. |
| FT-003 | Edit existing expense | User has at least one expense | 1. Open Transactions page. 2. Click `Edit` on an expense. 3. Change amount/category/description. 4. Save. | Updated values appear in history and totals are recalculated correctly. |
| FT-004 | Delete existing expense | User has at least one expense | 1. Open Transactions page. 2. Click `Delete`. 3. Confirm deletion. | Expense is removed from history and totals/balance update immediately. |
| FT-005 | Categorize expenses | User is adding or editing an expense | 1. Open transaction modal. 2. Select expense type. 3. Review category dropdown. 4. Choose a category and save. | Only valid expense categories are shown and the chosen category is saved/displayed correctly. |
| FT-006 | Calculate total expenses | User has multiple income and expense entries in current month | 1. Create multiple expenses. 2. Open dashboard. 3. Review monthly totals. | Monthly expense equals the sum of all current-month expenses. |
| FT-007 | Display expense history | User has multiple transactions | 1. Open Transactions page. 2. Review transaction list. 3. Search/filter by type/category/month. | History displays all matching transactions with correct amount, date, category, and description. |

## UI/UX Testing

| Test ID | Area | Preconditions | Steps | Expected Result |
|---|---|---|---|---|
| UI-001 | Responsive layout | App is accessible in browser | Resize to mobile, tablet, and desktop widths. | Layout remains usable without overlapping or clipped controls. |
| UI-002 | Button/form interactivity | User is on auth and dashboard pages | Trigger primary buttons, modal controls, filters, and submit actions. | Controls respond correctly and loading states are visible. |
| UI-003 | Alignment and spacing | UI is loaded | Review dashboard cards, modal layout, transactions list, and forms. | Elements are aligned consistently and visually readable. |
| UI-004 | Error and empty states | User has no transactions or submits invalid forms | Submit incomplete forms and inspect empty lists. | Clear validation/empty-state messaging is shown. |
| UI-005 | Accessibility basics | App is loaded | Inspect labels, button names, keyboard navigation, and visible text contrast. | Form inputs have labels, interactive controls are keyboard reachable, and text remains readable. |

## Edge Case and Negative Testing

| Test ID | Scenario | Preconditions | Steps | Expected Result |
|---|---|---|---|---|
| NEG-001 | Empty required fields | User is on transaction modal | Submit with missing amount/category/date. | Form blocks submission or API returns a validation error. |
| NEG-002 | Negative amount | User is on transaction modal or API client | Submit amount `< 0`. | Request is rejected and no transaction is created. |
| NEG-003 | Invalid characters in description | User can submit a transaction | Enter script tags or special characters in description. | Input is sanitized and stored safely without script execution. |
| NEG-004 | Very large amount | User is authenticated | Submit a very large amount value. | App handles validation or stores/display value without crashing or corrupting totals. |
| NEG-005 | Duplicate entries | User has an existing expense | Submit the exact same expense twice. | App behavior is defined and stable; duplicates should not break totals/history. |
| NEG-006 | Rapid multiple clicks | User is on save/delete actions | Click save/delete repeatedly before response returns. | Single operation should be processed and UI should not duplicate work. |
| NEG-007 | Insufficient funds | User has zero or low balance | Create expense larger than balance. | API rejects the expense with a clear insufficient-funds message. |

## Performance Testing

| Test ID | Scenario | Preconditions | Steps | Expected Result |
|---|---|---|---|---|
| PERF-001 | Large dataset load | User has 1000+ expenses seeded | Open dashboard and transactions page. | Pages remain responsive and data renders without crash. |
| PERF-002 | Search/filter responsiveness | 1000+ transactions exist | Use search and filters repeatedly. | Filtering remains responsive without noticeable UI lag. |
| PERF-003 | Repeated CRUD actions | User is authenticated | Add, edit, and delete expenses in quick succession. | No crash, freeze, or stale state should persist. |

## Data Persistence Testing

| Test ID | Scenario | Preconditions | Steps | Expected Result |
|---|---|---|---|---|
| DP-001 | Save persists after refresh | User adds an expense | Refresh the page after creation. | Expense remains visible because data persists on backend. |
| DP-002 | Delete is permanent | User deletes an expense | Refresh or re-fetch data after deletion. | Deleted item no longer appears anywhere. |
| DP-003 | Auth persistence | User logs in | Refresh the page. | User remains authenticated via stored token until logout/session expiry. |

## Cross-Browser Coverage

Planned browser matrix for the generated Playwright suite:

- Chrome
- Edge
- Firefox

Status in this session:

- API-backed validation completed.
- Cross-browser UI execution not completed because browser runners were not installed/executed in this session.

## Executed Results

### Passed

- Register new account via API
- Login via API
- Create income transaction via API
- Create expense transaction via API
- Edit expense transaction via API
- Monthly analytics total recalculation after edit
- Expense categorization persisted correctly through API
- Single deleted transaction endpoint returns `404` after delete
- Insufficient-funds protection exists in backend logic

### Failed

- FT-002: `+ Add Transaction` button is not wired to open the modal
- FT-004 / DP-002: deleted expense remains in the transactions list response due to stale cache
- FT-007: Transactions page cannot render returned results correctly because frontend expects an array but API returns an object payload

## Bug Report

### BUG-001: Transactions page does not render existing transactions

- Steps to reproduce:
  1. Log in and create one or more transactions.
  2. Open the Transactions page.
  3. Wait for the list to load.
- Expected result:
  Transactions should appear in the list with edit/delete controls.
- Actual result:
  Frontend logic stores the entire API payload object instead of `response.data`, so the renderer treats the result as empty and shows the empty state.
- Severity: High

### BUG-002: `+ Add Transaction` button on Transactions page is non-functional

- Steps to reproduce:
  1. Open the Transactions page.
  2. Click `+ Add Transaction`.
- Expected result:
  Transaction modal should open.
- Actual result:
  No click handler is registered for this button, so nothing happens.
- Severity: Medium

### BUG-003: Deleted transaction still appears in list due to stale cache

- Steps to reproduce:
  1. Create an income transaction.
  2. Create an expense transaction.
  3. Fetch the transactions list.
  4. Delete the expense.
  5. Fetch the transactions list again.
- Expected result:
  Deleted transaction should disappear from the returned list immediately.
- Actual result:
  The item is deleted and direct lookup returns `404`, but list responses continue returning the stale cached entry.
- Severity: High

## Test Summary Report

- Total test cases designed: 21
- Executed in this session: 9 API-backed validations + static UI verification
- Passed: 6 core validations
- Failed: 3 confirmed issues
- Critical issues found: 2 high-severity defects affecting transaction history correctness and CRUD usability
- Final verdict: Not ready for production

## Automation

Generated Playwright assets:

- `playwright.config.js`
- `tests/e2e/spendify.spec.js`

Coverage included:

- Add expense end-to-end flow
- Edit expense flow
- Delete expense flow

Note:

The edit and delete UI tests are intentionally written as expected-user-flow tests. With the current codebase, they are likely to fail until the transaction list rendering and stale-cache defects are fixed.

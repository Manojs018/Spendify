$loginBody = @{
    email = "finaltest_verify@example.com"
    password = "StrongPass@123"
} | ConvertTo-Json

# Use WebSession to handle cookies (including CSRF)
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginResp = Invoke-RestMethod -Uri 'http://localhost:5000/api/auth/login' -Method POST -ContentType 'application/json' -Body $loginBody -WebSession $session
$token = $loginResp.data.token
Write-Host "Login OK. Token length: $($token.Length)"

# Fetch CSRF token
try {
    $csrfResp = Invoke-RestMethod -Uri 'http://localhost:5000/api/csrf-token' -Method GET -WebSession $session
    $csrfToken = $csrfResp.csrfToken
    Write-Host "CSRF Token: $csrfToken"
} catch {
    # Try from cookies
    $csrfToken = $session.Cookies.GetCookies('http://localhost:5000') | Where-Object { $_.Name -eq 'XSRF-TOKEN' } | Select-Object -ExpandProperty Value
    Write-Host "CSRF from cookie: $csrfToken"
}

$headers = @{ 
    Authorization = "Bearer $token"
    'X-XSRF-TOKEN' = $csrfToken
}

Write-Host "`n=== Adding Income Transaction ==="
$incomeBody = @{
    type = "income"
    amount = 5000
    category = "Salary"
    description = "Monthly Salary"
    date = (Get-Date -Format "yyyy-MM-dd")
} | ConvertTo-Json

try {
    $incomeResp = Invoke-RestMethod -Uri 'http://localhost:5000/api/transactions' -Method POST -ContentType 'application/json' -Headers $headers -Body $incomeBody -WebSession $session
    Write-Host "Income added: $($incomeResp.success) - Amount: $($incomeResp.data.amount)"
} catch {
    Write-Host "Income error: $($_.ErrorDetails.Message)"
}

Write-Host "=== Adding Expense Transaction ==="
$expenseBody = @{
    type = "expense"
    amount = 1200
    category = "Food & Dining"
    description = "Groceries"
    date = (Get-Date -Format "yyyy-MM-dd")
} | ConvertTo-Json

try {
    $expenseResp = Invoke-RestMethod -Uri 'http://localhost:5000/api/transactions' -Method POST -ContentType 'application/json' -Headers $headers -Body $expenseBody -WebSession $session
    Write-Host "Expense added: $($expenseResp.success) - Amount: $($expenseResp.data.amount)"
} catch {
    Write-Host "Expense error: $($_.ErrorDetails.Message)"
}

Write-Host "`n=== Analytics Summary After Transactions ==="
$analyticsResp = Invoke-RestMethod -Uri 'http://localhost:5000/api/analytics/summary' -Method GET -Headers $headers -WebSession $session
Write-Host "Balance: `$$($analyticsResp.data.balance)"
Write-Host "Monthly Income: `$$($analyticsResp.data.monthly.income)"
Write-Host "Monthly Expense: `$$($analyticsResp.data.monthly.expense)"
Write-Host "Top Categories: $($analyticsResp.data.topCategories | ConvertTo-Json)"

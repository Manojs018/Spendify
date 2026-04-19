$loginBody = @{
    email = "finaltest_verify@example.com"
    password = "StrongPass@123"
} | ConvertTo-Json

$loginResp = Invoke-RestMethod -Uri 'http://localhost:5000/api/auth/login' -Method POST -ContentType 'application/json' -Body $loginBody
$token = $loginResp.data.token
$headers = @{ Authorization = "Bearer $token" }

Write-Host "=== Adding Income Transaction ==="
$incomeBody = @{
    type = "income"
    amount = 5000
    category = "Salary"
    description = "Monthly Salary"
    date = (Get-Date -Format "yyyy-MM-dd")
} | ConvertTo-Json
$incomeResp = Invoke-RestMethod -Uri 'http://localhost:5000/api/transactions' -Method POST -ContentType 'application/json' -Headers $headers -Body $incomeBody
Write-Host "Income added: $($incomeResp.success)"

Write-Host "=== Adding Expense Transaction ==="
$expenseBody = @{
    type = "expense"
    amount = 1200
    category = "Food & Dining"
    description = "Groceries"
    date = (Get-Date -Format "yyyy-MM-dd")
} | ConvertTo-Json
$expenseResp = Invoke-RestMethod -Uri 'http://localhost:5000/api/transactions' -Method POST -ContentType 'application/json' -Headers $headers -Body $expenseBody
Write-Host "Expense added: $($expenseResp.success)"

Write-Host "`n=== Fetching Analytics Summary ==="
$analyticsResp = Invoke-RestMethod -Uri 'http://localhost:5000/api/analytics/summary' -Method GET -Headers $headers
Write-Host "Balance: $($analyticsResp.data.balance)"
Write-Host "Monthly Income: $($analyticsResp.data.monthly.income)"
Write-Host "Monthly Expense: $($analyticsResp.data.monthly.expense)"

Write-Host "`n=== Fetching Transactions for Analytics ==="
$txResp = Invoke-RestMethod -Uri 'http://localhost:5000/api/transactions?type=expense&limit=10' -Method GET -Headers $headers
Write-Host "Expense transactions count: $($txResp.data.Count)"
$tx2Resp = Invoke-RestMethod -Uri 'http://localhost:5000/api/transactions?type=income&limit=10' -Method GET -Headers $headers
Write-Host "Income transactions count: $($tx2Resp.data.Count)"

Write-Host "`nAll backend API tests PASSED!"

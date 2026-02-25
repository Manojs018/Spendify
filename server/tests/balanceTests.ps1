# balanceTests.ps1  -  Negative Balance Prevention Tests for Spendify
# Run: powershell -ExecutionPolicy Bypass -File server/tests/balanceTests.ps1

$BASE = "http://127.0.0.1:5000/api"
$BYPASS = "spendify-dev-test-bypass"
[int]$script:p = 0
[int]$script:f = 0
$script:tok = ""

function ParseJson($txt) {
    try { return $txt | ConvertFrom-Json }
    catch { return [PSCustomObject]@{ message = $txt } }
}

function ApiReq($method, $path, $body = $null, $auth = $true) {
    $uri = "$BASE$path"
    $bodyJson = if ($null -ne $body) { $body | ConvertTo-Json -Depth 10 -Compress } else { $null }
    try {
        $wr = [System.Net.HttpWebRequest]::CreateHttp($uri)
        $wr.Method = $method.ToUpper()
        $wr.ContentType = "application/json"
        $wr.Accept = "application/json"
        $wr.Timeout = 30000
        $wr.KeepAlive = $false
        $wr.Headers.Add("X-Test-Bypass", $BYPASS)
        if ($auth -and $script:tok) { $wr.Headers.Add("Authorization", "Bearer $script:tok") }
        if ($bodyJson) {
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($bodyJson)
            $wr.ContentLength = $bytes.Length
            $s = $wr.GetRequestStream(); $s.Write($bytes, 0, $bytes.Length); $s.Close()
        }
        else { $wr.ContentLength = 0 }
        $resp = $wr.GetResponse()
        $sc = [int]$resp.StatusCode
        $rd = [System.IO.StreamReader]::new($resp.GetResponseStream())
        $txt = $rd.ReadToEnd(); $rd.Close(); $resp.Close()
        return @{ s = $sc; b = (ParseJson $txt) }
    }
    catch [System.Net.WebException] {
        $sc = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
        $txt = ""
        if ($_.Exception.Response) {
            $rd = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            $txt = $rd.ReadToEnd(); $rd.Close()
        }
        return @{ s = $sc; b = (ParseJson $txt) }
    }
    catch {
        return @{ s = 0; b = [PSCustomObject]@{ message = $_.Exception.Message } }
    }
}

function Chk($ok, $lbl, $d = "") {
    if ($ok) { Write-Host "  [PASS] $lbl" -ForegroundColor Green; $script:p += 1 }
    else { Write-Host "  [FAIL] $lbl`n         -> $d" -ForegroundColor Red; $script:f += 1 }
}
function MH($r, $kw) { "$($r.b.message)".ToLower() -like "*$($kw.ToLower())*" }
function Sec($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  SPENDIFY - NEGATIVE BALANCE PREVENTION TESTS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# ── SETUP: register a fresh user ─────────────────────────────────────────────
Sec "SETUP"
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$r = ApiReq POST "/auth/register" @{ name = "BalanceBot"; email = "balance_$ts@t.com"; password = "BalanceTest1!" } $false
if ($r.s -eq 201) {
    $script:tok = $r.b.data.token
    Write-Host "  [OK] Registered. Starting balance: `$0.00" -ForegroundColor Green
}
else {
    Write-Host "  [FAIL] Register: $($r.s) $($r.b.message)" -ForegroundColor Red; exit 1
}

# ── 1. EXPENSE ON ZERO BALANCE ────────────────────────────────────────────────
Sec "1. EXPENSE ON ZERO BALANCE"

$r = ApiReq POST "/transactions" @{ amount = 50; type = "expense"; category = "Food" }
Chk ($r.s -eq 400) "Expense 50 on 0 balance -> 400" "$($r.s): $($r.b.message)"
Chk (MH $r "Insufficient") "Error says Insufficient funds" "$($r.b.message)"
Chk ("$($r.b.balance)" -ne "") "Balance field returned in error response" "balance=$($r.b.balance)"

# ── 2. ADD INCOME, THEN VALID EXPENSE ────────────────────────────────────────
Sec "2. VALID EXPENSE WITHIN BALANCE"

$r = ApiReq POST "/transactions" @{ amount = 100; type = "income"; category = "Salary" }
Chk ($r.s -eq 201) "Add 100 income -> 201" "$($r.s): $($r.b.message)"
$incomeId = $r.b.data._id
Chk ([double]$r.b.balance -eq 100) "Balance is 100 after income" "balance=$($r.b.balance)"

$r = ApiReq POST "/transactions" @{ amount = 40; type = "expense"; category = "Food" }
Chk ($r.s -eq 201) "Expense 40 (have 100) -> 201" "$($r.s): $($r.b.message)"
$expense1Id = $r.b.data._id
Chk ([double]$r.b.balance -eq 60) "Balance is 60 after 40 expense" "balance=$($r.b.balance)"

# ── 3. EXPENSE EXCEEDING BALANCE ─────────────────────────────────────────────
Sec "3. EXPENSE EXCEEDS BALANCE"

$r = ApiReq POST "/transactions" @{ amount = 61; type = "expense"; category = "Rent" }
Chk ($r.s -eq 400) "Expense 61 when balance=60 -> 400" "$($r.s): $($r.b.message)"
Chk (MH $r "Insufficient") "Error says Insufficient funds" "$($r.b.message)"
Chk (MH $r "60") "Error message includes current balance (60)" "$($r.b.message)"

# Verify balance unchanged after rejected expense
$r = ApiReq GET "/auth/me"
Chk ([double]$r.b.data.balance -eq 60) "Balance still 60 after rejected expense" "balance=$($r.b.data.balance)"

# ── 4. EXPENSE EXACTLY EQUAL TO BALANCE ──────────────────────────────────────
Sec "4. EXPENSE EXACTLY EQUALS BALANCE (EDGE CASE)"

$r = ApiReq POST "/transactions" @{ amount = 60; type = "expense"; category = "Rent" }
Chk ($r.s -eq 201) "Expense 60 when balance=60 -> 201 (allowed)" "$($r.s): $($r.b.message)"
$expense2Id = $r.b.data._id
Chk ([double]$r.b.balance -eq 0) "Balance is exactly 0 (not negative)" "balance=$($r.b.balance)"

# ── 5. NO EXPENSE ON ZERO BALANCE ────────────────────────────────────────────
Sec "5. ANY EXPENSE ON ZERO BALANCE REJECTED"

$r = ApiReq POST "/transactions" @{ amount = 0.01; type = "expense"; category = "Fee" }
Chk ($r.s -eq 400) "Expense 0.01 on 0 balance -> 400" "$($r.s): $($r.b.message)"
Chk (MH $r "Insufficient") "Error says Insufficient funds" "$($r.b.message)"

# ── 6. UPDATE TRANSACTION CAUSING NEGATIVE BALANCE ───────────────────────────
Sec "6. UPDATE TRANSACTION CAUSING NEGATIVE BALANCE"

# Setup: income=30 + income=20, then expense=25 -> balance=25
$r = ApiReq POST "/transactions" @{ amount = 30; type = "income"; category = "Bonus" }
Chk ($r.s -eq 201) "Add 30 income -> 201" "$($r.b.message)"
$income2Id = $r.b.data._id

$r = ApiReq POST "/transactions" @{ amount = 20; type = "income"; category = "Tips" }
Chk ($r.s -eq 201) "Add 20 income -> balance=50" "$($r.b.message)"
$income3Id = $r.b.data._id

$r = ApiReq POST "/transactions" @{ amount = 25; type = "expense"; category = "Bills" }
Chk ($r.s -eq 201) "Spend 25 -> balance=25" "$($r.b.message)"
$expense3Id = $r.b.data._id

# Try updating expense from 25 to 100 (would need 100 but only 25 remains)
$r = ApiReq PUT "/transactions/$expense3Id" @{ amount = 100; type = "expense"; category = "Bills" }
Chk ($r.s -eq 400) "Update expense 25->100 (only 25 left) -> 400" "$($r.s): $($r.b.message)"
Chk (MH $r "Insufficient") "Error says Insufficient funds" "$($r.b.message)"

# Verify balance unchanged after rejected update
$r = ApiReq GET "/auth/me"
Chk ([double]$r.b.data.balance -eq 25) "Balance still 25 after rejected update" "balance=$($r.b.data.balance)"

# ── 7. UPDATE INCOME TO EXPENSE CAUSING NEGATIVE BALANCE ─────────────────────
Sec "7. UPDATE INCOME->EXPENSE CAUSING NEGATIVE BALANCE"

# Current balance=25. Changing 30 income -> 30 expense would result in -35
$r = ApiReq PUT "/transactions/$income2Id" @{ amount = 30; type = "expense"; category = "Penalty" }
Chk ($r.s -eq 400) "Change income->expense when it would go negative -> 400" "$($r.s): $($r.b.message)"
Chk (MH $r "Insufficient") "Error says Insufficient funds" "$($r.b.message)"

# ── 8. DELETE INCOME TRANSACTION CAUSING NEGATIVE BALANCE ────────────────────
Sec "8. DELETE INCOME CAUSING NEGATIVE BALANCE"

# balance=25, deleting the 30 income would give balance=-5 (REJECTED)
$r = ApiReq DELETE "/transactions/$income2Id"
Chk ($r.s -eq 400) "Delete 30 income when balance=25 -> 400" "$($r.s): $($r.b.message)"
Chk (MH $r "negative balance" -or MH $r "Cannot delete") "Error mentions negative balance prevention" "$($r.b.message)"

# Verify balance unchanged
$r = ApiReq GET "/auth/me"
Chk ([double]$r.b.data.balance -eq 25) "Balance still 25 after rejected income delete" "balance=$($r.b.data.balance)"

# ── 9. DELETE EXPENSE IS ALWAYS SAFE ─────────────────────────────────────────
Sec "9. DELETE EXPENSE (ADDS BACK - ALWAYS SAFE)"

$r = ApiReq DELETE "/transactions/$expense3Id"
Chk ($r.s -eq 200) "Delete 25 expense -> 200 (balance += 25)" "$($r.s): $($r.b.message)"
Chk ([double]$r.b.balance -eq 50) "Balance is 50 after expense deleted" "balance=$($r.b.balance)"

# ── 10. CONSECUTIVE EXPENSES (ATOMIC SAFETY) ─────────────────────────────────
Sec "10. CONSECUTIVE EXPENSES - ATOMIC SAFETY"

# Balance is 50 now
$r = ApiReq POST "/transactions" @{ amount = 30; type = "expense"; category = "Food" }
Chk ($r.s -eq 201) "First 30 expense -> 201 (balance=20)" "$($r.b.message)"
$exp4Id = $r.b.data._id
Chk ([double]$r.b.balance -eq 20) "Balance is 20" "balance=$($r.b.balance)"

$r = ApiReq POST "/transactions" @{ amount = 25; type = "expense"; category = "Transport" }
Chk ($r.s -eq 400) "Second 25 expense (only 20 left) -> 400" "$($r.s): $($r.b.message)"
Chk (MH $r "Insufficient") "Error says Insufficient funds" "$($r.b.message)"

$r = ApiReq GET "/auth/me"
Chk ([double]$r.b.data.balance -eq 20) "Balance is still 20 (atomic guard worked)" "balance=$($r.b.data.balance)"

# ── 11. INCOME ALWAYS SUCCEEDS ───────────────────────────────────────────────
Sec "11. INCOME TRANSACTIONS ALWAYS ALLOWED"

$r = ApiReq POST "/transactions" @{ amount = 500000; type = "income"; category = "Jackpot" }
Chk ($r.s -eq 201) "Large income (500000) always accepted -> 201" "$($r.b.message)"
$bigIncomeId = $r.b.data._id

# ── 12. TRANSFER INSUFFICIENT FUNDS ──────────────────────────────────────────
Sec "12. TRANSFER INSUFFICIENT FUNDS"

# Drain balance to $0 using chunks (amount must be <= 1,000,000 each step)
$r = ApiReq GET "/auth/me"
$bal = [double]$r.b.data.balance
$iter = 0
while ($bal -gt 0 -and $iter -lt 20) {
    $chunk = [Math]::Min([Math]::Floor($bal), 999999)
    if ($chunk -lt 0.01) { break }
    $rd = ApiReq POST "/transactions" @{ amount = $chunk; type = "expense"; category = "Drain" }
    $bal = [double]$rd.b.balance
    $iter++
}
Write-Host "  [INFO] Balance after drain: $bal" -ForegroundColor DarkGray

# With balance=$0, sender check fires before recipient lookup -> 400 Insufficient balance
$r = ApiReq POST "/transfer/send" @{ recipientEmail = "anyone@example.com"; amount = 50 }
Chk ($r.s -eq 400) "Transfer 50 when balance=0 -> 400" "$($r.s): $($r.b.message)"
Chk (MH $r "Insufficient" -or MH $r "balance") "Error says Insufficient balance" "$($r.b.message)"

# ── SUMMARY ───────────────────────────────────────────────────────────────────
$total = $script:p + $script:f
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  RESULTS: $($script:p)/$total PASSED" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
if ($script:f -eq 0) {
    Write-Host "  ALL $total TESTS PASSED - Balance protection is SOLID!" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "  $($script:f) test(s) FAILED" -ForegroundColor Red
    exit 1
}

#!/usr/bin/env pwsh
# sanitizationTests.ps1  -  Spendify Input Sanitization Tests (PS 5.1 compatible)
# Run: powershell -ExecutionPolicy Bypass -File server/tests/sanitizationTests.ps1

$BASE   = "http://127.0.0.1:5000/api"
$BYPASS = "spendify-dev-test-bypass"
$Global:passed = 0
$Global:failed = 0
$Global:token  = ""

# ─── HTTP helper (PowerShell 5.1 compatible) ──────────────────────────────────
function Req {
    param(
        [string]$method,
        [string]$path,
        [hashtable]$body = $null,
        [bool]$auth = $true
    )

    $headers = @{ "X-Test-Bypass" = $BYPASS }
    if ($auth -and $Global:token) {
        $headers["Authorization"] = "Bearer $($Global:token)"
    }

    $uri     = "$BASE$path"
    $bodyStr = if ($null -ne $body) { $body | ConvertTo-Json -Depth 10 -Compress } else { $null }

    try {
        $webReq = [System.Net.WebRequest]::Create($uri)
        $webReq.Method      = $method.ToUpper()
        $webReq.Timeout     = 10000
        $webReq.ContentType = "application/json"
        foreach ($h in $headers.GetEnumerator()) {
            $webReq.Headers.Add($h.Key, $h.Value)
        }

        if ($null -ne $bodyStr) {
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($bodyStr)
            $webReq.ContentLength = $bytes.Length
            $stream = $webReq.GetRequestStream()
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.Close()
        } else {
            $webReq.ContentLength = 0
        }

        $resp   = $webReq.GetResponse()
        $stream = $resp.GetResponseStream()
        $reader = [System.IO.StreamReader]::new($stream)
        $text   = $reader.ReadToEnd()
        $reader.Close(); $resp.Close()
        $json   = $text | ConvertFrom-Json
        return @{ status = [int]$resp.StatusCode; body = $json }

    } catch [System.Net.WebException] {
        $sc = 0
        $j  = @{ message = "" }
        if ($_.Exception.Response) {
            $sc     = [int]$_.Exception.Response.StatusCode
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = [System.IO.StreamReader]::new($stream)
            $text   = $reader.ReadToEnd()
            $reader.Close()
            try { $j = $text | ConvertFrom-Json } catch {}
        }
        return @{ status = $sc; body = $j }

    } catch {
        return @{ status = 0; body = @{ message = $_.Exception.Message } }
    }
}

# ─── Helpers ─────────────────────────────────────────────────────────────────
function Assert {
    param([bool]$ok, [string]$label, [string]$detail = "")
    if ($ok) {
        Write-Host "  [PASS] $label" -ForegroundColor Green
        $Global:passed++
    } else {
        Write-Host "  [FAIL] $label" -ForegroundColor Red
        if ($detail) { Write-Host "         -> $detail" -ForegroundColor Yellow }
        $Global:failed++
    }
}

function Section { param([string]$t); Write-Host "`n=== $t ===" -ForegroundColor Cyan }

function MsgHas {
    param($resp, [string]$kw)
    $lkw = $kw.ToLower()
    if ("$($resp.body.message)".ToLower() -like "*$lkw*") { return $true }
    foreach ($e in @($resp.body.errors)) {
        if ("$e".ToLower() -like "*$lkw*") { return $true }
    }
    return $false
}

# ─── Setup ───────────────────────────────────────────────────────────────────
Section "Setup - Create test user"
$ts    = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$email = "sanitest_${ts}@spendify.test"
$reg   = Req "POST" "/auth/register" @{ name="SanitizeBot"; email=$email; password="SanitizeTest1!" } $false

if ($reg.status -eq 201) {
    $Global:token = $reg.body.data.token
    Write-Host "  [OK] Registered: $email" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Could not register (status $($reg.status))" -ForegroundColor Red
    Write-Host "  $($reg.body.message)" -ForegroundColor Yellow
    exit 1
}

# ─── 1. XSS Prevention ───────────────────────────────────────────────────────
Section "1. XSS Prevention"

$LT = [char]60  # <
$GT = [char]62  # >
$xssPayloads = @(
    ($LT + 'script' + $GT + 'alert("xss")' + $LT + '/script' + $GT),
    ($LT + 'img src=x onerror=alert(1)' + $GT),
    ($LT + 'svg onload=alert(1)' + $GT),
    ('">' + $LT + 'script' + $GT + 'alert(document.cookie)' + $LT + '/script' + $GT),
    'javascript:alert(1)'
)

foreach ($p in $xssPayloads) {
    $short = if ($p.Length -gt 50) { $p.Substring(0,50) + "..." } else { $p }
    $r = Req "POST" "/transactions" @{ amount=10; type="income"; category="Test"; description=$p }

    if ($r.status -eq 201) {
        $stored     = "$($r.body.data.description)"
        $hasScript  = $stored -match ($LT + "script")
        $hasHandler = $stored -match "on[a-zA-Z]+=\s*"
        Assert (-not $hasScript -and -not $hasHandler) `
            "XSS stripped from description: '$short'" "Stored: '$stored'"
        $id = $r.body.data._id
        if ($id) { Req "DELETE" "/transactions/$id" | Out-Null }
    } else {
        Assert ($r.status -eq 400) "XSS payload blocked (status $($r.status)): '$short'" "$($r.body.message)"
    }
}

# XSS in category
$catPay = ($LT + 'script' + $GT + 'alert(1)' + $LT + '/script' + $GT)
$catR   = Req "POST" "/transactions" @{ amount=10; type="income"; category=$catPay }
Assert ($catR.status -eq 400) "XSS in category field -> 400" "$($catR.body.message)"

# ─── 2. NoSQL Injection Prevention ───────────────────────────────────────────
Section "2. NoSQL Injection Prevention"

$loginInj = Req "POST" "/auth/login" @{ email=@{ '$gt'="" }; password="anything" } $false
Assert ($loginInj.status -eq 400) "NoSQL `$gt in login email -> 400" "Got $($loginInj.status): $($loginInj.body.message)"

$txInj = Req "POST" "/transactions" @{ amount=@{ '$gt'=0 }; type="income"; category="Test" }
Assert ($txInj.status -eq 400) "NoSQL `$gt in transaction amount -> 400" "Got $($txInj.status): $($txInj.body.message)"

$qInj = Req "GET" '/transactions?type[$ne]=income'
Assert ($qInj.status -eq 400) "NoSQL `$ne in query string -> 400" "Got $($qInj.status): $($qInj.body.message)"

$trInj = Req "POST" "/transfer/send" @{ recipientEmail=@{ '$regex'=".*" }; amount=10 }
Assert ($trInj.status -eq 400) "NoSQL `$regex in recipientEmail -> 400" "Got $($trInj.status): $($trInj.body.message)"

$arrInj = Req "POST" "/transactions" @{ amount=@(1,2,3); type="income"; category="Test" }
Assert ($arrInj.status -eq 400) "Array injected into amount -> 400" "Got $($arrInj.status): $($arrInj.body.message)"

# ─── 3. ReDoS Prevention ─────────────────────────────────────────────────────
Section "3. ReDoS Prevention - catastrophic patterns respond in under 3s"

$patterns = @("(a+)+", "(a|aa)+", "(.*a){20}", "a{1,30}b{1,30}c{1,30}")
foreach ($p in $patterns) {
    $enc   = [Uri]::EscapeDataString($p)
    $start = Get-Date
    $res   = Req "GET" "/transactions?search=$enc"
    $ms    = [int]((Get-Date) - $start).TotalMilliseconds
    Assert ($ms -lt 3000 -and ($res.status -eq 200 -or $res.status -eq 400)) `
        "ReDoS search '$p' -> ${ms}ms" "status=$($res.status)"
}

$enc   = [Uri]::EscapeDataString("(a+)+")
$start = Get-Date
$res   = Req "GET" "/transactions?category=$enc"
$ms    = [int]((Get-Date) - $start).TotalMilliseconds
Assert ($ms -lt 3000 -and ($res.status -eq 200 -or $res.status -eq 400)) "ReDoS category -> ${ms}ms"

# ─── 4. Input Validation ─────────────────────────────────────────────────────
Section "4. Input Validation - clear error messages"

# Transaction body
$r = Req "POST" "/transactions" @{ type="income"; category="Food" }
Assert ($r.status -eq 400 -and (MsgHas $r "amount")) "Missing amount -> 400 + 'amount'" "Got $($r.status): $($r.body.message)"

$r = Req "POST" "/transactions" @{ amount=50; type="transfer"; category="Food" }
Assert ($r.status -eq 400 -and (MsgHas $r "Type")) "Invalid type -> 400 + 'Type'" "Got $($r.status): $($r.body.message)"

$r = Req "POST" "/transactions" @{ amount=50; type="income" }
Assert ($r.status -eq 400 -and (MsgHas $r "Category")) "Missing category -> 400 + 'Category'" "Got $($r.status): $($r.body.message)"

$r = Req "POST" "/transactions" @{ amount=-5; type="income"; category="Food" }
Assert ($r.status -eq 400 -and (MsgHas $r "Amount")) "Negative amount -> 400 + 'Amount'" "Got $($r.status): $($r.body.message)"

$r = Req "POST" "/transactions" @{ amount=0; type="income"; category="Food" }
Assert ($r.status -eq 400 -and (MsgHas $r "Amount")) "Zero amount -> 400 + 'Amount'" "Got $($r.status): $($r.body.message)"

$r = Req "POST" "/transactions" @{ amount=10; type="income"; category="Food"; description=("x"*201) }
Assert ($r.status -eq 400 -and (MsgHas $r "200")) "Description > 200 chars -> 400 + '200'" "Got $($r.status): $($r.body.message)"

$r = Req "POST" "/transactions" @{ amount=10; type="income"; category="Food$($LT)br$($GT)" }
Assert ($r.status -eq 400 -and (MsgHas $r "invalid")) "Category with HTML -> 400 + 'invalid'" "Got $($r.status): $($r.body.message)"

$r = Req "POST" "/transactions" @{ amount=10; type="income"; category="Food"; date="not-a-date" }
Assert ($r.status -eq 400 -and (MsgHas $r "Date")) "Invalid date -> 400 + 'Date'" "Got $($r.status): $($r.body.message)"

# Query params
$r = Req "GET" "/transactions?sort=__proto__"
Assert ($r.status -eq 400 -and (MsgHas $r "Sort")) "Prototype-polluting sort -> 400 + 'Sort'" "Got $($r.status): $($r.body.message)"

$r = Req "GET" "/transactions?page=-1"
Assert ($r.status -eq 400 -and (MsgHas $r "Page")) "Negative page -> 400 + 'Page'" "Got $($r.status): $($r.body.message)"

$r = Req "GET" "/transactions?limit=999"
Assert ($r.status -eq 400 -and (MsgHas $r "Limit")) "Limit > 100 -> 400 + 'Limit'" "Got $($r.status): $($r.body.message)"

$r = Req "GET" "/transactions?month=13&year=2024"
Assert ($r.status -eq 400 -and (MsgHas $r "Month")) "Month out of range -> 400 + 'Month'" "Got $($r.status): $($r.body.message)"

$r = Req "GET" "/transactions?year=1999"
Assert ($r.status -eq 400 -and (MsgHas $r "Year")) "Year out of range -> 400 + 'Year'" "Got $($r.status): $($r.body.message)"

# Transfer body
$r = Req "POST" "/transfer/send" @{ amount=10 }
Assert ($r.status -eq 400 -and (MsgHas $r "email")) "Transfer: missing email -> 400 + 'email'" "Got $($r.status): $($r.body.message)"

$r = Req "POST" "/transfer/send" @{ recipientEmail="not-an-email"; amount=10 }
Assert ($r.status -eq 400 -and (MsgHas $r "email")) "Transfer: invalid email -> 400 + 'email'" "Got $($r.status): $($r.body.message)"

$r = Req "POST" "/transfer/send" @{ recipientEmail="a@b.com" }
Assert ($r.status -eq 400 -and (MsgHas $r "Amount")) "Transfer: missing amount -> 400 + 'Amount'" "Got $($r.status): $($r.body.message)"

$r = Req "POST" "/transfer/send" @{ recipientEmail="a@b.com"; amount=-50 }
Assert ($r.status -eq 400 -and (MsgHas $r "Amount")) "Transfer: negative amount -> 400 + 'Amount'" "Got $($r.status): $($r.body.message)"

$r = Req "POST" "/transfer/send" @{ recipientEmail="a@b.com"; amount=10; description=("y"*201) }
Assert ($r.status -eq 400 -and (MsgHas $r "200")) "Transfer: desc > 200 chars -> 400 + '200'" "Got $($r.status): $($r.body.message)"

# Transfer search
$r = Req "GET" "/transfer/search"
Assert ($r.status -eq 400) "Transfer search: no email -> 400" "$($r.body.message)"

$r = Req "GET" "/transfer/search?email=$("a"*101)"
Assert ($r.status -eq 400) "Transfer search: 101-char email -> 400" "$($r.body.message)"

# ─── 5. Clean Inputs Pass Through ─────────────────────────────────────────────
Section "5. Clean inputs pass through correctly"

$ids = @()
$utcNow = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

$c1 = Req "POST" "/transactions" @{ amount=42.50; type="income"; category="Salary"; description="Monthly salary Q1-2024"; date=$utcNow }
Assert ($c1.status -eq 201) "Valid income transaction -> 201" "$($c1.body.message)"
if ($c1.status -eq 201) { $ids += $c1.body.data._id }

$c2 = Req "POST" "/transactions" @{ amount=15.00; type="expense"; category="Food"; description="Lunch at cafe" }
Assert ($c2.status -eq 201) "Valid expense transaction -> 201" "$($c2.body.message)"
if ($c2.status -eq 201) { $ids += $c2.body.data._id }

$r = Req "GET" "/transactions?type=expense&page=1&limit=10&sort=-date"
Assert ($r.status -eq 200) "GET /transactions valid params -> 200"

$r = Req "GET" "/transactions?search=Lunch"
Assert ($r.status -eq 200) "Search 'Lunch' -> 200"

$r = Req "GET" "/transactions?category=Salary"
Assert ($r.status -eq 200) "Category filter 'Salary' -> 200"

$year  = (Get-Date).Year
$month = (Get-Date).Month
$r = Req "GET" "/transactions?year=$year&month=$month"
Assert ($r.status -eq 200) "Date filter year+month -> 200"

foreach ($id in $ids) { Req "DELETE" "/transactions/$id" | Out-Null }

# ─── 6. XSS in Auth Fields ───────────────────────────────────────────────────
Section "6. XSS in Auth Fields"

$xssName  = ($LT + 'script' + $GT + 'alert("xss")' + $LT + '/script' + $GT)
$xssEmail = "xss_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())@test.com"
$xssReg   = Req "POST" "/auth/register" @{ name=$xssName; email=$xssEmail; password="ValidPass1!Ab" } $false

if ($xssReg.status -eq 201) {
    $stored = "$($xssReg.body.data.user.name)"
    Assert ($stored -notmatch ($LT + "script")) "XSS stripped from name on register" "Stored: '$stored'"
} else {
    Assert ($xssReg.status -eq 400) "XSS name rejected on register -> 400" "$($xssReg.body.message)"
}

$loginEmail = ($LT + "script" + $GT + "alert(1)" + $LT + "/script" + $GT + "@evil.com")
$loginXss   = Req "POST" "/auth/login" @{ email=$loginEmail; password="anything" } $false
Assert ($loginXss.status -eq 400 -or $loginXss.status -eq 401) `
    "XSS in login email handled safely (got $($loginXss.status), not 500)" "$($loginXss.body.message)"

# ─── Summary ─────────────────────────────────────────────────────────────────
$total = $Global:passed + $Global:failed
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  SANITIZATION TEST RESULTS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Total  : $total"
Write-Host "  Passed : $($Global:passed)" -ForegroundColor Green

if ($Global:failed -gt 0) {
    Write-Host "  Failed : $($Global:failed)" -ForegroundColor Red
    Write-Host ""
    Write-Host "  $($Global:failed) test(s) FAILED - review output above." -ForegroundColor Red
    exit 1
} else {
    Write-Host "  Failed : 0" -ForegroundColor Green
    Write-Host ""
    Write-Host "  ALL $total TESTS PASSED - Input sanitization is SOLID!" -ForegroundColor Green
    exit 0
}

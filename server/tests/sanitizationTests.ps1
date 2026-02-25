# sanitizationTests.ps1  –  full security test suite for Spendify
# Run: powershell -ExecutionPolicy Bypass -File server/tests/sanitizationTests.ps1

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

# ── SETUP ─────────────────────────────────────────────────────────────────────
Sec "SETUP"
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$r = ApiReq POST "/auth/register" @{ name = "Bot"; email = "san_$ts@t.com"; password = "SanitizeTest1!" } $false
if ($r.s -eq 201) { $script:tok = $r.b.data.token; Write-Host "  [OK] Registered (201)" -ForegroundColor Green }
else { Write-Host "  [FAIL] $($r.s): $($r.b.message)" -ForegroundColor Red; exit 1 }

# ── 1. XSS ────────────────────────────────────────────────────────────────────
Sec "1. XSS PREVENTION"
$lt = [char]60; $gt = [char]62
@(
    ($lt + 'script' + $gt + 'alert("x")' + $lt + '/script' + $gt),
    ($lt + 'img src=x onerror=alert(1)' + $gt),
    'javascript:alert(1)'
) | ForEach-Object {
    $payload = [string]$_
    $short = $payload.Substring(0, [Math]::Min(40, $payload.Length))
    $r = ApiReq POST "/transactions" @{ amount = 10; type = "income"; category = "Test"; description = $payload }
    if ($r.s -eq 201) {
        $st = "$($r.b.data.description)"
        Chk ($st -notmatch ($lt + "script") -and $st -notmatch "on[a-zA-Z]+=") `
            "XSS stripped: '$short'" "Stored: '$st'"
        $id = $r.b.data._id; if ($id) { ApiReq DELETE "/transactions/$id" | Out-Null }
    }
    else {
        Chk ($r.s -eq 400) "XSS blocked ($($r.s)): '$short'" "$($r.b.message)"
    }
}
$r = ApiReq POST "/transactions" @{ amount = 10; type = "income"; category = ($lt + "script" + $gt + "x" + $lt + "/script" + $gt) }
Chk ($r.s -eq 400) "XSS in category -> 400" "$($r.b.message)"

# ── 2. NoSQL ──────────────────────────────────────────────────────────────────
Sec "2. NoSQL INJECTION"
$r = ApiReq POST "/auth/login" @{ email = @{ '$gt' = "" }; password = "x" } $false
Chk ($r.s -eq 400) "NoSQL gt in email -> 400" "$($r.s): $($r.b.message)"
$r = ApiReq POST "/transactions" @{ amount = @{ '$gt' = 0 }; type = "income"; category = "T" }
Chk ($r.s -eq 400) "NoSQL gt in amount -> 400" "$($r.s): $($r.b.message)"
$r = ApiReq GET '/transactions?type[$ne]=income'
Chk ($r.s -eq 400) "NoSQL ne in query -> 400" "$($r.s): $($r.b.message)"
$r = ApiReq POST "/transfer/send" @{ recipientEmail = @{ '$regex' = ".*" }; amount = 10 }
Chk ($r.s -eq 400) "NoSQL in recipientEmail -> 400" "$($r.s): $($r.b.message)"
$r = ApiReq POST "/transactions" @{ amount = @(1, 2, 3); type = "income"; category = "T" }
Chk ($r.s -eq 400) "Array injection -> 400" "$($r.s): $($r.b.message)"

# ── 3. ReDoS ──────────────────────────────────────────────────────────────────
Sec "3. ReDoS PREVENTION"
@("(a+)+", "(a|aa)+", "(.*a){20}", "a{1,30}b{1,30}c{1,30}") | ForEach-Object {
    $enc = [Uri]::EscapeDataString($_); $t0 = Get-Date
    $res = ApiReq GET "/transactions?search=$enc"
    $ms = [int]((Get-Date) - $t0).TotalMilliseconds
    Chk ($ms -lt 3000 -and ($res.s -eq 200 -or $res.s -eq 400)) "ReDoS '$_' -> ${ms}ms"
}
$t0 = Get-Date
$res = ApiReq GET "/transactions?category=$([Uri]::EscapeDataString('(a+)+'))"
$ms = [int]((Get-Date) - $t0).TotalMilliseconds
Chk ($ms -lt 3000 -and ($res.s -eq 200 -or $res.s -eq 400)) "ReDoS category -> ${ms}ms"

# ── 4. VALIDATION ─────────────────────────────────────────────────────────────
Sec "4. INPUT VALIDATION"
$r = ApiReq POST "/transactions" @{ type = "income"; category = "Food" }
Chk ($r.s -eq 400 -and (MH $r "amount")) "Missing amount -> 400+amount" "$($r.s):$($r.b.message)"
$r = ApiReq POST "/transactions" @{ amount = 50; type = "transfer"; category = "Food" }
Chk ($r.s -eq 400 -and (MH $r "Type")) "Invalid type -> 400+Type" "$($r.s):$($r.b.message)"
$r = ApiReq POST "/transactions" @{ amount = 50; type = "income" }
Chk ($r.s -eq 400 -and (MH $r "Category")) "Missing category -> 400+Cat" "$($r.s):$($r.b.message)"
$r = ApiReq POST "/transactions" @{ amount = -5; type = "income"; category = "Food" }
Chk ($r.s -eq 400 -and (MH $r "Amount")) "Neg amount -> 400+Amount" "$($r.s):$($r.b.message)"
$r = ApiReq POST "/transactions" @{ amount = 0; type = "income"; category = "Food" }
Chk ($r.s -eq 400 -and (MH $r "Amount")) "Zero amount -> 400+Amount" "$($r.s):$($r.b.message)"
$r = ApiReq POST "/transactions" @{ amount = 10; type = "income"; category = "Food"; description = ("x" * 201) }
Chk ($r.s -eq 400 -and (MH $r "200")) "Desc>200 -> 400+200" "$($r.s):$($r.b.message)"
$r = ApiReq POST "/transactions" @{ amount = 10; type = "income"; category = "Food$($lt)br$($gt)" }
Chk ($r.s -eq 400 -and (MH $r "invalid")) "HTML in category -> 400+invalid" "$($r.s):$($r.b.message)"
$r = ApiReq POST "/transactions" @{ amount = 10; type = "income"; category = "Food"; date = "nope" }
Chk ($r.s -eq 400 -and (MH $r "Date")) "Bad date -> 400+Date" "$($r.s):$($r.b.message)"
$r = ApiReq GET "/transactions?sort=__proto__"
Chk ($r.s -eq 400 -and (MH $r "Sort")) "Bad sort -> 400+Sort" "$($r.s):$($r.b.message)"
$r = ApiReq GET "/transactions?page=-1"
Chk ($r.s -eq 400 -and (MH $r "Page")) "Neg page -> 400+Page" "$($r.s):$($r.b.message)"
$r = ApiReq GET "/transactions?limit=999"
Chk ($r.s -eq 400 -and (MH $r "Limit")) "Limit>100 -> 400+Limit" "$($r.s):$($r.b.message)"
$r = ApiReq GET "/transactions?month=13&year=2024"
Chk ($r.s -eq 400 -and (MH $r "Month")) "Month OOR -> 400+Month" "$($r.s):$($r.b.message)"
$r = ApiReq GET "/transactions?year=1999"
Chk ($r.s -eq 400 -and (MH $r "Year")) "Year OOR -> 400+Year" "$($r.s):$($r.b.message)"
$r = ApiReq POST "/transfer/send" @{ amount = 10 }
Chk ($r.s -eq 400 -and (MH $r "email")) "Xfer no email -> 400+email" "$($r.s):$($r.b.message)"
$r = ApiReq POST "/transfer/send" @{ recipientEmail = "bad"; amount = 10 }
Chk ($r.s -eq 400 -and (MH $r "email")) "Xfer bad email -> 400+email" "$($r.s):$($r.b.message)"
$r = ApiReq POST "/transfer/send" @{ recipientEmail = "a@b.com" }
Chk ($r.s -eq 400 -and (MH $r "Amount")) "Xfer no amount -> 400+Amount" "$($r.s):$($r.b.message)"
$r = ApiReq POST "/transfer/send" @{ recipientEmail = "a@b.com"; amount = -50 }
Chk ($r.s -eq 400 -and (MH $r "Amount")) "Xfer neg amount -> 400+Amount" "$($r.s):$($r.b.message)"
$r = ApiReq GET "/transfer/search"
Chk ($r.s -eq 400) "Xfer search no email -> 400" "$($r.b.message)"
$r = ApiReq GET "/transfer/search?email=$("a"*101)"
Chk ($r.s -eq 400) "Xfer search 101-char -> 400" "$($r.b.message)"

# ── 5. CLEAN INPUTS ───────────────────────────────────────────────────────────
Sec "5. CLEAN INPUTS"
$ids = @(); $utc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$r = ApiReq POST "/transactions" @{ amount = 42.5; type = "income"; category = "Salary"; description = "Monthly salary"; date = $utc }
Chk ($r.s -eq 201) "Income tx -> 201" "$($r.b.message)"; if ($r.s -eq 201) { $ids += $r.b.data._id }
$r = ApiReq POST "/transactions" @{ amount = 15; type = "expense"; category = "Food"; description = "Lunch" }
Chk ($r.s -eq 201) "Expense tx -> 201" "$($r.b.message)"; if ($r.s -eq 201) { $ids += $r.b.data._id }
$r = ApiReq GET "/transactions?type=expense&page=1&limit=10&sort=-date"
Chk ($r.s -eq 200) "GET valid params -> 200"
$r = ApiReq GET "/transactions?search=Lunch"
Chk ($r.s -eq 200) "Search -> 200"
$r = ApiReq GET "/transactions?category=Salary"
Chk ($r.s -eq 200) "Cat filter -> 200"
$r = ApiReq GET "/transactions?year=$((Get-Date).Year)&month=$((Get-Date).Month)"
Chk ($r.s -eq 200) "Date filter -> 200"
foreach ($id in $ids) { if ($id) { ApiReq DELETE "/transactions/$id" | Out-Null } }

# ── 6. XSS IN AUTH ────────────────────────────────────────────────────────────
Sec "6. XSS IN AUTH"
$xn = $lt + 'script' + $gt + 'alert("x")' + $lt + '/script' + $gt
$r = ApiReq POST "/auth/register" @{ name = $xn; email = "xss_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())@t.com"; password = "ValidPass1!Ab" } $false
if ($r.s -eq 201) {
    $st = "$($r.b.data.user.name)"
    Chk ($st -notmatch ($lt + "script")) "XSS stripped from name" "Stored: '$st'"
}
else {
    Chk ($r.s -eq 400) "XSS name -> 400" "$($r.s): $($r.b.message)"
}
$r = ApiReq POST "/auth/login" @{ email = ($lt + "script" + $gt + "a" + $lt + "/script" + $gt + "@e.com"); password = "x" } $false
Chk ($r.s -eq 400 -or $r.s -eq 401) "XSS login email safe ($($r.s))" "$($r.b.message)"

# ── SUMMARY ───────────────────────────────────────────────────────────────────
$total = $script:p + $script:f
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  RESULTS: $($script:p)/$total PASSED" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
if ($script:f -eq 0) {
    Write-Host "  ALL $total TESTS PASSED - Input sanitization is SOLID!" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "  $($script:f) test(s) FAILED" -ForegroundColor Red
    exit 1
}

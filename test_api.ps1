$body = @{
    name = "Final Test User"
    email = "finaltest_verify@example.com"
    password = "StrongPass@123"
} | ConvertTo-Json

Write-Host "Testing registration..."
try {
    $resp = Invoke-RestMethod -Uri 'http://localhost:5000/api/auth/register' -Method POST -ContentType 'application/json' -Body $body
    Write-Host "Registration SUCCESS:"
    $resp | ConvertTo-Json
} catch {
    $errBody = $_.ErrorDetails.Message
    Write-Host "Registration response: $errBody"
}

Write-Host "`nTesting login..."
$loginBody = @{
    email = "finaltest_verify@example.com"
    password = "StrongPass@123"
} | ConvertTo-Json

try {
    $loginResp = Invoke-RestMethod -Uri 'http://localhost:5000/api/auth/login' -Method POST -ContentType 'application/json' -Body $loginBody
    Write-Host "Login SUCCESS! Token received."
    $token = $loginResp.data.token
    Write-Host "Token: $token"
    
    Write-Host "`nTesting analytics with token..."
    $headers = @{ Authorization = "Bearer $token" }
    $analyticsResp = Invoke-RestMethod -Uri 'http://localhost:5000/api/analytics/summary' -Method GET -Headers $headers
    Write-Host "Analytics Summary SUCCESS:"
    $analyticsResp | ConvertTo-Json -Depth 5
} catch {
    $errBody = $_.ErrorDetails.Message
    Write-Host "Login/Analytics response: $errBody"
}

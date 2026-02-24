# debugReq.ps1
$uri = "http://127.0.0.1:5000/api/auth/register"
$bodyStr = '{"name":"DebugBot","email":"debug999@test.com","password":"SanitizeTest1!"}'
$bypass = "spendify-dev-test-bypass"

Write-Host "Testing WebRequest to $uri"

try {
    $webReq = [System.Net.WebRequest]::Create($uri)
    $webReq.Method      = "POST"
    $webReq.Timeout     = 10000
    $webReq.ContentType = "application/json"
    $webReq.Headers.Add("X-Test-Bypass", $bypass)

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($bodyStr)
    $webReq.ContentLength = $bytes.Length

    $stream = $webReq.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()

    Write-Host "Request sent, waiting for response..."
    $resp   = $webReq.GetResponse()
    $rStream = $resp.GetResponseStream()
    $reader = [System.IO.StreamReader]::new($rStream)
    $text   = $reader.ReadToEnd()
    $reader.Close()
    $resp.Close()

    Write-Host "SUCCESS - Status: $([int]$resp.StatusCode)"
    Write-Host "Body: $text"

} catch [System.Net.WebException] {
    Write-Host "WebException: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $sc = [int]$_.Exception.Response.StatusCode
        Write-Host "HTTP Status: $sc"
        $rStream = $_.Exception.Response.GetResponseStream()
        $reader  = [System.IO.StreamReader]::new($rStream)
        $text    = $reader.ReadToEnd()
        $reader.Close()
        Write-Host "Error body: $text"
    } else {
        Write-Host "No HTTP response attached to exception"
    }
} catch {
    Write-Host "Other exception: $($_.Exception.GetType().Name)"
    Write-Host "Message: $($_.Exception.Message)"
}

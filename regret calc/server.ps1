$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "Regret Calculator running at http://localhost:$port/" -ForegroundColor Green
    Write-Host "Reading configuration directly from .env file." -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Yellow
    Start-Process "http://localhost:$port/"

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response
        
        $path = $req.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrEmpty($path)) { $path = 'index.html' }
        
        $localFile = Join-Path $PSScriptRoot $path
        if (Test-Path $localFile -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($localFile)
            $ext = [System.IO.Path]::GetExtension($localFile).ToLower()
            $contentType = switch ($ext) {
                '.html' { 'text/html' }
                '.css'  { 'text/css' }
                '.js'   { 'application/javascript' }
                '.json' { 'application/json' }
                '.env'  { 'text/plain' }
                default { 'application/octet-stream' }
            }
            $res.ContentType = $contentType
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $res.StatusCode = 404
        }
        $res.Close()
    }
} finally {
    $listener.Stop()
}

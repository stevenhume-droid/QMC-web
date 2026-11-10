$res = Invoke-WebRequest -Uri 'https://api.discogs.com/database/search?q=test' -Headers @{'User-Agent'='QMCVinylArchive/2.0'} -Method Get
Write-Output "Status: $($res.StatusCode)"
Write-Output "Access-Control-Allow-Origin: $($res.Headers['Access-Control-Allow-Origin'])"


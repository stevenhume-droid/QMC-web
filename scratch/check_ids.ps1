$ids = @(13184010, 1379435, 4040777, 16972509, 9535646)
foreach ($id in $ids) {
    try {
        $r = Invoke-RestMethod -Uri "https://api.discogs.com/releases/$id" -Headers @{"User-Agent"="QMCVinylArchive/2.0"}
        Write-Output "ID ${id}: $($r.title) | $($r.artists_sort) | $($r.labels[0].name) $($r.labels[0].catno) | $($r.formats[0].descriptions -join ', ') | $($r.formats[0].text)"
    } catch {
        Write-Output "ID ${id}: error $_"
    }
}

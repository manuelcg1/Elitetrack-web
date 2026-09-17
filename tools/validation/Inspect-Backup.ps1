# Read-only archive inspection. No connection to PostgreSQL and no SQL execution.
param([string]$Archive = 'backups/traccar-pre-sutran-20260828-162624.backup')
$ErrorActionPreference = 'Stop'
$binary = 'C:/Program Files/PostgreSQL/18/bin/pg_restore.exe'
& $binary --file=NUL $Archive
if ($LASTEXITCODE -ne 0) { throw 'Archive decoding failed' }
$result = [ordered]@{ archiveSha256 = (Get-FileHash $Archive -Algorithm SHA256).Hash; decoded = $true }
foreach ($table in @('databasechangelog', 'tc_user_geofencefolder', 'tc_geofence_folders', 'tc_user_geofence', 'tc_forward_servers')) {
    $lines = @(& $binary --data-only --table=$table --file=- $Archive)
    if ($LASTEXITCODE -ne 0) { throw "Cannot inspect $table" }
    $inside = $false
    $rows = @()
    foreach ($line in $lines) {
        if ($line.StartsWith('COPY ')) { $inside = $true; continue }
        if ($line -eq '\.') { $inside = $false; continue }
        if ($inside) { $rows += $line }
    }
    if ($table -eq 'databasechangelog') {
        $result.migrations = @($rows | ForEach-Object {
            $parts = $_ -split "`t"
            if ($parts[2] -match 'sutran|geofence|gps-inventory|roles|alerts') {
                [pscustomobject]@{ id = $parts[0]; file = $parts[2]; execution = $parts[5]; checksum = $parts[6] }
            }
        })
    } else {
        $summary = [ordered]@{ rows = $rows.Count }
        if ($table -in @('tc_user_geofencefolder', 'tc_user_geofence')) {
            $summary.duplicatePairs = @($rows | Group-Object | Where-Object Count -gt 1).Count
        }
        if ($table -eq 'tc_geofence_folders') {
            $parents = @{}
            foreach ($row in $rows) { $parts = $row -split "`t"; $parents[$parts[0]] = $parts[3] }
            $invalidPaths = 0
            foreach ($id in $parents.Keys) {
                $seen = @{}
                $current = $id
                while ($current -ne '0') {
                    if ($seen.ContainsKey($current) -or -not $parents.ContainsKey($current)) {
                        $invalidPaths++; break
                    }
                    $seen[$current] = $true
                    $current = $parents[$current]
                }
            }
            $summary.cyclicOrMissingParentPaths = $invalidPaths
        }
        if ($table -eq 'tc_forward_servers') {
            $summary.activeRows = @($rows | Where-Object { ($_ -split "`t")[5] -eq 't' }).Count
            $summary.rowsWithPasswordOrApiKey = @($rows | Where-Object {
                $parts = $_ -split "`t"
                ($parts[4] -notin @('', '\N')) -or ($parts[6] -notin @('', '\N'))
            }).Count
        }
        $result[$table] = $summary
    }
}
$result | ConvertTo-Json -Depth 6

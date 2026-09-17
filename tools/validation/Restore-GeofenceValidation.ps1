param(
    [string]$StatePath = (Join-Path $PSScriptRoot '../../build/pg-validation-current.json'),
    [switch]$KeepRunning
)

$ErrorActionPreference = 'Stop'
$pgBin = 'C:/Program Files/PostgreSQL/18/bin'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
$dataPath = [IO.Path]::GetFullPath($state.data)
$allowedPrefix = (Join-Path $workspace 'build/pg-validation-')
if (-not $dataPath.StartsWith($allowedPrefix, [StringComparison]::OrdinalIgnoreCase) -or
    (Split-Path $dataPath -Leaf) -ne 'data' -or $state.database -ne 'geofence_validation') {
    throw 'Refusing to use a PostgreSQL cluster outside the disposable validation directory.'
}
$pidLines = Get-Content -LiteralPath (Join-Path $dataPath 'postmaster.pid')
if ([int]$pidLines[3] -ne [int]$state.port -or
    [IO.Path]::GetFullPath($pidLines[1]) -ne $dataPath) {
    throw 'The running cluster does not match the validation state.'
}

function Invoke-ValidationQuery([string]$Database, [string]$Sql) {
    $result = & "$pgBin/psql.exe" -X -q -A -t -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $state.port -U validation_owner -d $Database -c $Sql
    if ($LASTEXITCODE -ne 0) { throw "Validation query failed in $Database" }
    return @($result)
}

function Get-ValidationManifest([string]$Database) {
    $tables = Invoke-ValidationQuery $Database @'
SELECT quote_ident(schemaname) || '.' || quote_ident(tablename)
FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY schemaname, tablename
'@
    foreach ($table in $tables) {
        $digest = Invoke-ValidationQuery $Database (
            "SELECT count(*) || ':' || md5(coalesce(string_agg(row_to_json(t)::text, E'\n' " +
            "ORDER BY row_to_json(t)::text COLLATE ""C""),'')) FROM $table t")
        "TABLE:$table=$digest"
    }
    Invoke-ValidationQuery $Database @'
SELECT 'COLUMN:' || table_schema || '.' || table_name || '.' || column_name || ':' ||
row_number() OVER (PARTITION BY table_schema, table_name ORDER BY ordinal_position) || ':' ||
data_type || ':' || is_nullable || ':' || coalesce(column_default,'')
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog','information_schema')
ORDER BY table_schema, table_name, ordinal_position
'@
    Invoke-ValidationQuery $Database @'
SELECT 'CONSTRAINT:' || n.nspname || '.' || c.relname || '.' || con.conname || ':' ||
pg_get_constraintdef(con.oid)
FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY n.nspname,c.relname,con.conname
'@
    Invoke-ValidationQuery $Database @'
SELECT 'INDEX:' || schemaname || '.' || tablename || '.' || indexname || ':' || indexdef
FROM pg_indexes WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY schemaname, tablename, indexname
'@
    Invoke-ValidationQuery $Database @'
SELECT 'SEQUENCE:' || schemaname || '.' || sequencename || ':' || coalesce(last_value::text,'NULL')
FROM pg_sequences WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY schemaname, sequencename
'@
}

try {
    $marker = @(Invoke-ValidationQuery 'geofence_validation' "SELECT current_setting('traccar.validation_cluster', true)")
    if ($marker.Count -ne 1 -or $marker[0] -ne $state.token) {
        throw 'Refusing to back up an unmarked validation database.'
    }
    $archive = Join-Path $state.directory 'geofence-validation.dump'
    $before = @(Get-ValidationManifest 'geofence_validation')
    $beforePath = Join-Path $state.directory 'manifest-before.txt'
    $before | Set-Content -LiteralPath $beforePath -Encoding utf8
    & "$pgBin/pg_dump.exe" -h 127.0.0.1 -p $state.port -U validation_owner -d geofence_validation --format=custom --file=$archive
    if ($LASTEXITCODE -ne 0) { throw 'Isolated backup failed.' }

    $restoredDatabase = 'geofence_restored_' + [guid]::NewGuid().ToString('N').Substring(0, 8)
    & "$pgBin/createdb.exe" -h 127.0.0.1 -p $state.port -U validation_owner $restoredDatabase
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create the new restore target.' }
    & "$pgBin/pg_restore.exe" -h 127.0.0.1 -p $state.port -U validation_owner --exit-on-error --no-owner --dbname=$restoredDatabase $archive
    if ($LASTEXITCODE -ne 0) { throw 'Isolated restore failed.' }
    $after = @(Get-ValidationManifest $restoredDatabase)
    $afterPath = Join-Path $state.directory 'manifest-after.txt'
    $after | Set-Content -LiteralPath $afterPath -Encoding utf8
    $differences = @(Compare-Object $before $after)
    if ($differences.Count -gt 0) {
        $differences | ConvertTo-Json | Set-Content (Join-Path $state.directory 'restore-differences.json')
        throw 'Restore verification failed; manifests differ.'
    }
    $report = [ordered]@{
        database = 'geofence_validation'
        restoredDatabase = $restoredDatabase
        port = $state.port
        archive = $archive
        archiveBytes = (Get-Item -LiteralPath $archive).Length
        archiveSha256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
        comparedManifestEntries = $before.Count
        tables = @($before | Where-Object { $_.StartsWith('TABLE:') }).Count
        manifestSha256 = (Get-FileHash -LiteralPath $beforePath -Algorithm SHA256).Hash
        restoredManifestSha256 = (Get-FileHash -LiteralPath $afterPath -Algorithm SHA256).Hash
        identical = $true
    }
    $report | ConvertTo-Json | Set-Content (Join-Path $workspace 'build/reports/geofence-postgres-restore.json')
    $report | ConvertTo-Json
} finally {
    if (-not $KeepRunning) {
        # Stop only this verified disposable cluster; retain its files and evidence.
        & "$pgBin/pg_ctl.exe" -D $dataPath -m fast -w stop
        if ($LASTEXITCODE -ne 0) { throw 'Failed to stop the isolated cluster.' }
    }
}

param([Parameter(Mandatory = $true)][string]$ConfigPath)

# Requires explicit authorization to use the configured local database connection.
# Never writes database data, prints credentials, or selects payloads/vehicle identifiers.
$ErrorActionPreference = 'Stop'
$previousPassword = $env:PGPASSWORD
$previousOptions = $env:PGOPTIONS
try {
    $settings = [Xml.XmlReaderSettings]::new()
    $settings.DtdProcessing = [Xml.DtdProcessing]::Ignore
    $settings.XmlResolver = $null
    $reader = [Xml.XmlReader]::Create([IO.Path]::GetFullPath($ConfigPath), $settings)
    try {
        $document = [Xml.XmlDocument]::new()
        $document.XmlResolver = $null
        $document.Load($reader)
    } finally { $reader.Dispose() }
    $databaseUrl = $document.SelectSingleNode('/properties/entry[@key="database.url"]').InnerText
    if ($databaseUrl -notmatch '^jdbc:postgresql://(localhost|127\.0\.0\.1):(5432)/traccar$') {
        throw 'Only the explicitly identified local traccar database on port 5432 is permitted.'
    }
    $databaseUser = $document.SelectSingleNode('/properties/entry[@key="database.user"]').InnerText
    $env:PGPASSWORD = $document.SelectSingleNode('/properties/entry[@key="database.password"]').InnerText
    $env:PGOPTIONS = '-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=2000'
    $query = @'
BEGIN READ ONLY;
SELECT current_database() AS database, inet_server_port() AS port,
       current_timestamp AS audited_at, current_setting('transaction_read_only') AS read_only;
SELECT status, count(*) AS rows, min(createdtime) AS oldest, max(createdtime) AS newest,
       min(attempts) AS min_attempts, max(attempts) AS max_attempts
FROM tc_forward_deliveries WHERE status IN ('PENDING','PROCESSING') GROUP BY status ORDER BY status;
SELECT serverid,status,attempts,httpstatus,responsecode,
       (crc IS NOT NULL AND btrim(crc)<>'') AS has_crc,count(*) AS rows
FROM tc_forward_deliveries WHERE status IN ('PENDING','PROCESSING')
GROUP BY serverid,status,attempts,httpstatus,responsecode,(crc IS NOT NULL AND btrim(crc)<>'')
ORDER BY serverid,status,attempts;
SELECT count(*) AS historical_2001_without_crc FROM tc_forward_deliveries
WHERE responsecode=2001 AND (crc IS NULL OR btrim(crc)='');
ROLLBACK;
'@
    $result = & 'C:/Program Files/PostgreSQL/18/bin/psql.exe' -X -w -h 127.0.0.1 -p 5432 `
        -U $databaseUser -d traccar -v ON_ERROR_STOP=1 -c $query 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Read-only SUTRAN audit failed; connection details withheld.' }
    $reportPath = Join-Path $PSScriptRoot '../../build/reports/sutran-legacy-pending-audit.txt'
    New-Item -ItemType Directory -Force -Path (Split-Path $reportPath) | Out-Null
    $result | Set-Content -LiteralPath $reportPath
    $result
} finally {
    $env:PGPASSWORD = $previousPassword
    $env:PGOPTIONS = $previousOptions
    $document = $null
}

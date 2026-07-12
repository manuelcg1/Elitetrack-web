#requires -Version 5.1

<#
.SYNOPSIS
    Simula posiciones GPS de varios vehiculos mediante el protocolo HTTP/OsmAnd.
.DESCRIPTION
    Es una herramienta de pruebas independiente. No modifica la configuracion ni el
    codigo de Traccar. Para detenerla de forma segura, presione Ctrl+C.
#>
[CmdletBinding()]
param(
    [string]$Server = "http://127.0.0.1:5055",
    [ValidateRange(0.1, 86400)]
    [double]$Intervalo = 1,
    [bool]$Repetir = $true,
    [ValidateRange(1, 500)]
    [double]$VelocidadMaxima = 80,
    [ValidateRange(0, 86400)]
    [double]$TiempoDetenido = 15
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

# Para agregar un vehiculo, copie un bloque y cambie Nombre, Imei y Ruta.
# Cada punto de Ruta se expresa como: latitud, longitud.
$vehiculos = @(
    [pscustomobject]@{
        Nombre = 'Vehiculo 1'
        Imei   = '999999999999991'
        Ruta   = @(
            , @(-8.1100, -79.0200)
            , @(-8.1098, -79.0197)
            , @(-8.1095, -79.0193)
            , @(-8.1092, -79.0189)
            , @(-8.1089, -79.0185)
            , @(-8.1086, -79.0181)
            , @(-8.1083, -79.0177)
            , @(-8.1080, -79.0173)
        )
    }
    [pscustomobject]@{
        Nombre = 'Vehiculo 2'
        Imei   = '999999999999992'
        Ruta   = @(
            , @(-8.1250, -79.0150)
            , @(-8.1248, -79.0146)
            , @(-8.1245, -79.0142)
            , @(-8.1242, -79.0138)
            , @(-8.1239, -79.0134)
            , @(-8.1236, -79.0130)
            , @(-8.1233, -79.0126)
            , @(-8.1230, -79.0122)
        )
    }
    [pscustomobject]@{
        Nombre = 'Vehiculo 3'
        Imei   = '999999999999993'
        Ruta   = @(
            , @(-8.1160, -79.0300)
            , @(-8.1157, -79.0296)
            , @(-8.1154, -79.0292)
            , @(-8.1151, -79.0288)
            , @(-8.1148, -79.0284)
            , @(-8.1145, -79.0280)
        )
    }
    [pscustomobject]@{
        Nombre = 'Vehiculo 4'
        Imei   = '999999999999994'
        Ruta   = @(
            , @(-8.1020, -79.0250)
            , @(-8.1023, -79.0246)
            , @(-8.1026, -79.0242)
            , @(-8.1029, -79.0238)
            , @(-8.1032, -79.0234)
            , @(-8.1035, -79.0230)
        )
    }
    [pscustomobject]@{
        Nombre = 'Vehiculo 5'
        Imei   = '999999999999995'
        Ruta   = @(
            , @(-8.1300, -79.0200)
            , @(-8.1296, -79.0203)
            , @(-8.1292, -79.0206)
            , @(-8.1288, -79.0209)
            , @(-8.1284, -79.0212)
            , @(-8.1280, -79.0215)
        )
    }
    [pscustomobject]@{
        Nombre = 'Vehiculo 6'
        Imei   = '999999999999996'
        Ruta   = @(
            , @(-8.0950, -79.0150)
            , @(-8.0954, -79.0147)
            , @(-8.0958, -79.0144)
            , @(-8.0962, -79.0141)
            , @(-8.0966, -79.0138)
            , @(-8.0970, -79.0135)
        )
    }
    [pscustomobject]@{
        Nombre = 'Vehiculo 7'
        Imei   = '999999999999997'
        Ruta   = @(
            , @(-8.1200, -79.0400)
            , @(-8.1197, -79.0395)
            , @(-8.1194, -79.0390)
            , @(-8.1191, -79.0385)
            , @(-8.1188, -79.0380)
            , @(-8.1185, -79.0375)
        )
    }
    [pscustomobject]@{
        Nombre = 'Vehiculo 8'
        Imei   = '999999999999998'
        Ruta   = @(
            , @(-8.1080, -79.0050)
            , @(-8.1084, -79.0053)
            , @(-8.1088, -79.0056)
            , @(-8.1092, -79.0059)
            , @(-8.1096, -79.0062)
            , @(-8.1100, -79.0065)
        )
    }
    [pscustomobject]@{
        Nombre = 'Vehiculo 9'
        Imei   = '999999999999999'
        Ruta   = @(
            , @(-8.1380, -79.0300)
            , @(-8.1376, -79.0296)
            , @(-8.1372, -79.0292)
            , @(-8.1368, -79.0288)
            , @(-8.1364, -79.0284)
            , @(-8.1360, -79.0280)
        )
    }
    [pscustomobject]@{
        Nombre = 'Vehiculo 10'
        Imei   = '888888888888880'
        Ruta   = @(
            , @(-8.0880, -79.0300)
            , @(-8.0883, -79.0295)
            , @(-8.0886, -79.0290)
            , @(-8.0889, -79.0285)
            , @(-8.0892, -79.0280)
            , @(-8.0895, -79.0275)
        )
    }
    [pscustomobject]@{
        Nombre = 'Vehiculo 11'
        Imei   = '888888888888881'
        Ruta   = @(
            , @(-8.1450, -79.0100)
            , @(-8.1446, -79.0104)
            , @(-8.1442, -79.0108)
            , @(-8.1438, -79.0112)
            , @(-8.1434, -79.0116)
            , @(-8.1430, -79.0120)
        )
    }
    [pscustomobject]@{
        Nombre = 'Vehiculo 12'
        Imei   = '888888888888882'
        Ruta   = @(
            , @(-8.1000, -79.0450)
            , @(-8.1004, -79.0446)
            , @(-8.1008, -79.0442)
            , @(-8.1012, -79.0438)
            , @(-8.1016, -79.0434)
            , @(-8.1020, -79.0430)
        )
    }
)

$patronVelocidades = @(15, 25, 40, 60, 80, 55, 30)
$culturaInvariante = [System.Globalization.CultureInfo]::InvariantCulture

function ConvertTo-InvariantString {
    param(
        [Parameter(Mandatory = $true)]
        [double]$Valor,
        [string]$Formato = '0.######'
    )

    return $Valor.ToString($Formato, $culturaInvariante)
}

function Get-Bearing {
    param(
        [Parameter(Mandatory = $true)][double]$LatitudInicial,
        [Parameter(Mandatory = $true)][double]$LongitudInicial,
        [Parameter(Mandatory = $true)][double]$LatitudFinal,
        [Parameter(Mandatory = $true)][double]$LongitudFinal
    )

    $gradosARadianes = [Math]::PI / 180
    $latitud1 = $LatitudInicial * $gradosARadianes
    $latitud2 = $LatitudFinal * $gradosARadianes
    $diferenciaLongitud = ($LongitudFinal - $LongitudInicial) * $gradosARadianes

    $y = [Math]::Sin($diferenciaLongitud) * [Math]::Cos($latitud2)
    $x = ([Math]::Cos($latitud1) * [Math]::Sin($latitud2)) -
        ([Math]::Sin($latitud1) * [Math]::Cos($latitud2) * [Math]::Cos($diferenciaLongitud))

    return ([Math]::Atan2($y, $x) / $gradosARadianes + 360) % 360
}

function New-OsmAndUri {
    param(
        [Parameter(Mandatory = $true)][string]$Servidor,
        [Parameter(Mandatory = $true)][string]$Imei,
        [Parameter(Mandatory = $true)][double]$Latitud,
        [Parameter(Mandatory = $true)][double]$Longitud,
        [Parameter(Mandatory = $true)][double]$VelocidadKmh,
        [Parameter(Mandatory = $true)][double]$Bearing
    )

    # El endpoint OsmAnd interpreta "speed" en nudos. La conversion hace que
    # Traccar y el frontend muestren la velocidad configurada en km/h.
    $velocidadNudos = $VelocidadKmh / 1.852
    $epoch = [DateTime]::UtcNow - [DateTime]::SpecifyKind([DateTime]'1970-01-01', [DateTimeKind]::Utc)
    $timestamp = [long][Math]::Floor($epoch.TotalSeconds)
    $servidorBase = $Servidor.TrimEnd('/')
    if ($servidorBase.EndsWith('?') -or $servidorBase.EndsWith('&')) {
        $separador = ''
    }
    elseif ($servidorBase.Contains('?')) {
        $separador = '&'
    }
    else {
        $separador = '/?'
    }

    $parametros = @(
        'id=' + [Uri]::EscapeDataString($Imei)
        'lat=' + (ConvertTo-InvariantString -Valor $Latitud)
        'lon=' + (ConvertTo-InvariantString -Valor $Longitud)
        'speed=' + (ConvertTo-InvariantString -Valor $velocidadNudos -Formato '0.###')
        'bearing=' + (ConvertTo-InvariantString -Valor $Bearing -Formato '0.##')
        'timestamp=' + $timestamp
        'valid=true'
    )

    return $servidorBase + $separador + ($parametros -join '&')
}

function Send-Position {
    param(
        [Parameter(Mandatory = $true)]$Vehiculo,
        [Parameter(Mandatory = $true)][int]$Indice,
        [Parameter(Mandatory = $true)][double]$VelocidadKmh,
        [Parameter(Mandatory = $true)][string]$Servidor,
        [double]$BearingForzado = [double]::NaN
    )

    $puntoActual = $Vehiculo.Ruta[$Indice]
    if ([double]::IsNaN($BearingForzado)) {
        $indiceSiguiente = ($Indice + 1) % $Vehiculo.Ruta.Count
        $puntoSiguiente = $Vehiculo.Ruta[$indiceSiguiente]
        $bearing = Get-Bearing -LatitudInicial $puntoActual[0] -LongitudInicial $puntoActual[1] `
            -LatitudFinal $puntoSiguiente[0] -LongitudFinal $puntoSiguiente[1]
    }
    else {
        # Un vehiculo detenido conserva la ultima orientacion conocida.
        $bearing = $BearingForzado
    }
    $uri = New-OsmAndUri -Servidor $Servidor -Imei $Vehiculo.Imei -Latitud $puntoActual[0] `
        -Longitud $puntoActual[1] -VelocidadKmh $VelocidadKmh -Bearing $bearing

    try {
        $respuesta = Invoke-WebRequest -Uri $uri -Method Get -UseBasicParsing -TimeoutSec 10
        if ($respuesta.StatusCode -lt 200 -or $respuesta.StatusCode -ge 300) {
            throw "El servidor respondio con HTTP $($respuesta.StatusCode)."
        }
        return [pscustomobject]@{ Correcto = $true; Error = $null; Bearing = $bearing }
    }
    catch {
        return [pscustomobject]@{ Correcto = $false; Error = $_.Exception.Message; Bearing = $bearing }
    }
}

function Write-PositionResult {
    param(
        [Parameter(Mandatory = $true)]$Vehiculo,
        [Parameter(Mandatory = $true)]$Punto,
        [Parameter(Mandatory = $true)][double]$VelocidadKmh,
        [Parameter(Mandatory = $true)]$Resultado
    )

    $color = if ($Resultado.Correcto) { 'Green' } else { 'Red' }
    Write-Host $Vehiculo.Nombre -ForegroundColor $color
    Write-Host ("Lat: {0}" -f (ConvertTo-InvariantString -Valor $Punto[0])) -ForegroundColor $color
    Write-Host ("Lon: {0}" -f (ConvertTo-InvariantString -Valor $Punto[1])) -ForegroundColor $color
    Write-Host ("Velocidad: {0} km/h" -f (ConvertTo-InvariantString -Valor $VelocidadKmh -Formato '0.#')) -ForegroundColor $color
    Write-Host ("Bearing: {0} grados" -f (ConvertTo-InvariantString -Valor $Resultado.Bearing -Formato '0.#')) -ForegroundColor $color
    if (-not $Resultado.Correcto) {
        Write-Host ("Error: {0}" -f $Resultado.Error) -ForegroundColor $color
    }
    Write-Host ''
}

if ($vehiculos.Count -eq 0) {
    throw 'Debe configurar al menos un vehiculo.'
}
foreach ($vehiculo in $vehiculos) {
    if ($vehiculo.Ruta.Count -lt 2) {
        throw "La ruta de '$($vehiculo.Nombre)' debe contener al menos dos puntos."
    }
}

$estados = @{}
foreach ($vehiculo in $vehiculos) {
    $estados[$vehiculo.Imei] = [pscustomobject]@{
        Indice              = 0
        DetencionRestante   = 0.0
        UltimoBearing       = 0.0
        Completado          = $false
    }
}

$paso = 0
$continuar = $true
Write-Host "Simulador iniciado. Destino: $Server. Presione Ctrl+C para detener." -ForegroundColor Cyan

try {
    while ($continuar) {
        Write-Host ("[{0}]" -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor Cyan

        foreach ($vehiculo in $vehiculos) {
            $estado = $estados[$vehiculo.Imei]
            if ($estado.Completado) {
                continue
            }

            $estaDetenido = $estado.DetencionRestante -gt 0
            if ($estaDetenido) {
                $indice = $vehiculo.Ruta.Count - 1
                $velocidad = 0.0
                $resultado = Send-Position -Vehiculo $vehiculo -Indice $indice `
                    -VelocidadKmh $velocidad -Servidor $Server -BearingForzado $estado.UltimoBearing
                $estado.DetencionRestante = [Math]::Max(
                    [double]0.0,
                    [double]($estado.DetencionRestante - $Intervalo))
            }
            else {
                $indice = [int]$estado.Indice
                $velocidad = [Math]::Min(
                    [double]$patronVelocidades[$paso % $patronVelocidades.Count],
                    $VelocidadMaxima)
                $resultado = Send-Position -Vehiculo $vehiculo -Indice $indice `
                    -VelocidadKmh $velocidad -Servidor $Server
                $estado.UltimoBearing = $resultado.Bearing
            }

            Write-PositionResult -Vehiculo $vehiculo -Punto $vehiculo.Ruta[$indice] `
                -VelocidadKmh $velocidad -Resultado $resultado

            if ($estaDetenido) {
                if ($estado.DetencionRestante -le 0) {
                    if ($Repetir) {
                        $estado.Indice = 0
                    }
                    else {
                        $estado.Completado = $true
                    }
                }
            }
            elseif ($indice -eq ($vehiculo.Ruta.Count - 1)) {
                if ($TiempoDetenido -gt 0) {
                    $estado.DetencionRestante = $TiempoDetenido
                    Write-Host ("$($vehiculo.Nombre) se detendra $TiempoDetenido segundos.") -ForegroundColor Yellow
                }
                elseif ($Repetir) {
                    $estado.Indice = 0
                }
                else {
                    $estado.Completado = $true
                }
            }
            else {
                $estado.Indice = $indice + 1
            }
        }

        $paso++
        if (-not $Repetir) {
            $continuar = $false
            foreach ($estado in $estados.Values) {
                if (-not $estado.Completado) {
                    $continuar = $true
                    break
                }
            }
        }

        if ($continuar) {
            Start-Sleep -Milliseconds ([int]($Intervalo * 1000))
        }
    }
}
finally {
    Write-Host 'Simulador detenido. No se modifico ninguna configuracion de Traccar.' -ForegroundColor Yellow
}

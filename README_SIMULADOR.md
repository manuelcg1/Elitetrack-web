# Simulador GPS para Traccar

`tools/simular_rutas.ps1` envia posiciones de varios vehiculos al endpoint HTTP/OsmAnd de Traccar. Es una utilidad de pruebas aislada: no modifica el backend, el frontend ni los archivos de configuracion, y no debe ejecutarse en produccion.

Antes de usarlo, registre en Traccar los doce dispositivos con estos identificadores unicos:

- `999999999999991`
- `999999999999992`
- `999999999999993`
- `999999999999994`
- `999999999999995`
- `999999999999996`
- `999999999999997`
- `999999999999998`
- `999999999999999`
- `888888888888880`
- `888888888888881`
- `888888888888882`

## Ejecucion

Desde la raiz del repositorio:

```powershell
.\tools\simular_rutas.ps1
```

El script envia una posicion de cada vehiculo por ciclo. Para detenerlo, presione `Ctrl+C`.

PowerShell puede bloquear scripts locales. Si ocurre, habilite solo esta sesion y vuelva a ejecutar:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\tools\simular_rutas.ps1
```

## Parametros y ejemplos

El servidor predeterminado es `http://127.0.0.1:5055`, el puerto estandar de OsmAnd en Traccar. El intervalo es un segundo, las rutas se repiten, la velocidad maxima es 80 km/h y cada vehiculo se detiene 15 segundos al final de su ruta.

Cambiar el servidor y enviar cada medio segundo:

```powershell
.\tools\simular_rutas.ps1 -Server 'http://192.168.1.20:5055' -Intervalo 0.5
```

Limitar todas las velocidades a 50 km/h:

```powershell
.\tools\simular_rutas.ps1 -VelocidadMaxima 50
```

Cambiar la detencion al final de la ruta a 30 segundos (use `0` para desactivarla):

```powershell
.\tools\simular_rutas.ps1 -TiempoDetenido 30
```

Recorrer cada ruta una sola vez y detenerse:

```powershell
.\tools\simular_rutas.ps1 -Repetir:$false
```

Los parametros se pueden combinar. La ejecucion del comando inicia la simulacion; `Ctrl+C` la detiene de forma segura.

## Agregar vehiculos

Edite solamente el arreglo `$vehiculos` al principio de `tools/simular_rutas.ps1`. Copie uno de sus bloques y asigne un nombre, un IMEI registrado en Traccar y al menos dos coordenadas:

```powershell
[pscustomobject]@{
    Nombre = 'Vehiculo 3'
    Imei   = '999999999999993'
    Ruta   = @(
        , @(-8.1300, -79.0100)
        , @(-8.1297, -79.0096)
        , @(-8.1294, -79.0092)
    )
}
```

No se necesita cambiar la logica: el script crea y actualiza un indice independiente para cada vehiculo.

## Cambiar rutas

Cada elemento de `Ruta` contiene `latitud, longitud`. Reemplace o agregue puntos en el orden en que deben recorrerse. Cuando `$Repetir` es verdadero, el ultimo punto enlaza nuevamente con el primero; ese tramo tambien determina el bearing.

Al llegar al ultimo punto, cada vehiculo permanece alli durante `$TiempoDetenido` segundos. Durante la pausa sigue reportando la misma coordenada con velocidad cero, por lo que permanece en linea y el frontend puede mostrarlo como detenido. Despues reinicia su ruta si `$Repetir` es verdadero.

## Cambiar velocidades

El patron esta en `$patronVelocidades` y inicialmente es `15, 25, 40, 60, 80, 55, 30` km/h. Puede editar esa lista o usar `-VelocidadMaxima` para imponer un limite sin cambiarla.

OsmAnd interpreta el parametro HTTP `speed` en nudos. El script convierte automaticamente de km/h a nudos para que Traccar y el frontend muestren la velocidad esperada. El bearing se calcula a partir del punto actual y el siguiente.

## Cambiar valores predeterminados

Los parametros al inicio del script contienen los valores editables:

```powershell
$Server = "http://127.0.0.1:5055"
$Intervalo = 1
$Repetir = $true
```

Es preferible pasar valores en la linea de comandos para mantener el archivo reutilizable. El puerto debe coincidir con el configurado para el protocolo OsmAnd en la instancia de Traccar.

## Preparacion para produccion

Detenga el simulador con `Ctrl+C` antes de validar dispositivos reales. No copie este script al paquete de despliegue ni configure su inicio automatico. Como la utilidad no cambia archivos de Traccar, el sistema vuelve a trabajar exclusivamente con datos reales en cuanto el simulador deja de ejecutarse.

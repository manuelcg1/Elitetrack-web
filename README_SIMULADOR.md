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

## Prueba de ingreso a una geocerca

Para comprobar la alerta `Entrada a geocerca` de forma repetible, use el
`Vehiculo 1` (`999999999999991`). La prueba propuesta comienza fuera de la
geocerca, la atraviesa de oeste a este, permanece fuera durante varios puntos y
la atraviesa nuevamente de este a oeste. Por lo tanto, una vuelta completa debe
generar dos eventos de ingreso y dos eventos de salida.

### 1. Crear la geocerca de prueba

En Traccar, abra **Geocercas**, cree una geocerca circular y use estos valores:

- Nombre: `Geocerca prueba simulador`.
- Centro: latitud `-8.109000`, longitud `-79.018700`.
- Radio: `120 m`.

Guarde la geocerca y vinculela al `Vehiculo 1`. Esta asociacion es necesaria
para que Traccar calcule los cambios entre fuera y dentro en cada posicion.

### 2. Crear la alerta

En **Monitoreo > Alertas**, cree o edite una alerta con esta configuracion:

- Tipo: `Entrada a geocerca`.
- Estado: activa.
- Vehiculo: `Vehiculo 1`.
- Geocerca: `Geocerca prueba simulador`.
- Notificacion de plataforma: activa.

La geocerca tambien debe estar disponible para el usuario que realiza la
prueba. Si se selecciona un grupo de vehiculos o un grupo de geocercas, confirme
que el vehiculo y la geocerca pertenezcan a esos grupos.

### 3. Usar un recorrido mas extenso

En `tools/simular_rutas.ps1`, reemplace solamente el arreglo `Ruta` del bloque
`Vehiculo 1` por el siguiente recorrido. Cada punto se envia una vez por ciclo:

```powershell
Ruta   = @(
    # Aproximacion desde el oeste: fuera de la geocerca.
    , @(-8.110800, -79.022000)
    , @(-8.110400, -79.021400)
    , @(-8.110000, -79.020800)
    , @(-8.109600, -79.020200)
    , @(-8.109400, -79.019800)

    # Primer ingreso y cruce por el centro.
    , @(-8.109100, -79.019300)
    , @(-8.109000, -79.018900)
    , @(-8.109000, -79.018700)
    , @(-8.109000, -79.018300)
    , @(-8.108900, -79.017900)

    # Salida por el este y recorrido exterior.
    , @(-8.108700, -79.017200)
    , @(-8.108100, -79.016700)
    , @(-8.107400, -79.016900)
    , @(-8.106900, -79.017700)
    , @(-8.106700, -79.018700)
    , @(-8.107000, -79.019700)
    , @(-8.107600, -79.020200)
    , @(-8.108300, -79.019900)

    # Segundo ingreso, ahora desde el noreste hacia el oeste.
    , @(-8.108700, -79.019300)
    , @(-8.108900, -79.018900)
    , @(-8.109000, -79.018700)
    , @(-8.109200, -79.019200)

    # Segunda salida y final de la vuelta.
    , @(-8.109500, -79.019900)
    , @(-8.110000, -79.020800)
    , @(-8.110500, -79.021500)
    , @(-8.110800, -79.022000)
)
```

Con el intervalo predeterminado de un segundo, el vehiculo tarda unos 26
segundos en recorrer los puntos y luego permanece 15 segundos detenido. Para
observar con mas claridad los cambios en el mapa puede usar un intervalo de dos
segundos y reducir la pausa final:

```powershell
.\tools\simular_rutas.ps1 -Intervalo 2 -TiempoDetenido 5
```

### 4. Resultado esperado

Durante una vuelta completa debe observar esta secuencia para el `Vehiculo 1`:

1. Comienza fuera de la geocerca y no genera una alerta de ingreso.
2. Entra por primera vez y genera un evento `geofenceEnter`.
3. Sale por el este y genera un evento `geofenceExit` si existe una alerta de salida.
4. Continua por el exterior sin generar nuevos eventos de ingreso.
5. Ingresa por segunda vez y genera otro evento `geofenceEnter`.
6. Sale hacia el oeste y finaliza nuevamente fuera de la geocerca.

Cada transicion real de fuera hacia dentro crea un evento nuevo siempre que no
este bloqueada por el periodo de cooldown de la alerta. Para validar todos los
ingresos de este recorrido, configure `cooldownMinutes` en `0`; las posiciones
consecutivas que permanecen dentro no deben crear alertas duplicadas. Si se usa
un cooldown mayor que cero, se aplica por alerta, vehiculo, geocerca y tipo de
evento, por lo que una geocerca distinta no bloquea la notificacion.

Si ejecuta el simulador con `-Repetir:$false`, la secuencia se realiza una sola
vez. Con el valor predeterminado `$true`, se repite despues de la pausa final y
permite comprobar nuevos ingresos en cada vuelta.

### Diagnostico si no aparece la alerta

Compruebe, en este orden:

1. El IMEI `999999999999991` esta registrado y corresponde al vehiculo seleccionado.
2. El dispositivo aparece en linea y cambia de coordenadas en el mapa.
3. La geocerca esta vinculada al dispositivo y tiene exactamente el centro y radio indicados.
4. La alerta esta activa y contiene tanto el vehiculo como la geocerca correctos.
5. La notificacion de plataforma esta habilitada para mostrar el popup.
6. El usuario tiene permiso para consultar el vehiculo, la geocerca y el menu de alertas.
7. La hora del servidor y la hora enviada por el simulador son validas.

En la consola del simulador, cada envio correcto aparece en verde junto con su
latitud, longitud, velocidad y bearing. Un error HTTP aparece en rojo y debe
resolverse antes de evaluar la alerta.

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

## Probar notificaciones Telegram de alertas personalizadas

Para desarrollo, agregue a `debug.xml` las siguientes entradas antes de cerrar
`</properties>`:

```xml
<entry key='notificator.types'>web,telegram</entry>
<entry key='notificator.telegram.key'>TOKEN_DEL_BOT</entry>
<entry key='notificator.telegram.sendLocation'>true</entry>
```

No confirme el token real en Git. En produccion agregue las mismas propiedades
a `/opt/traccar/traccar.xml` usando el secreto suministrado por BotFather y
reinicie el servicio Traccar.

El creador de la alerta debe tener este atributo de usuario:

```json
{
  "telegramChatId": "123456789"
}
```

El usuario debe haber iniciado previamente una conversacion con el bot. En
**Monitoreo > Alertas**, habilite Telegram. El atributo guardado en la alerta
debe tener este formato:

```json
{
  "notifications": ["platform", "telegram"]
}
```

Para una prueba local, ejecute el servidor con `debug.xml`, cree la alerta con
el usuario que contiene `telegramChatId` y genere el evento con el simulador.
Primero debe aparecer un registro en `tc_alert_events`; el envio Telegram se
realiza despues en un hilo asincrono. Si Telegram no esta habilitado, el chat no
existe o la API responde con error, el evento permanece guardado y el flujo GPS
continua funcionando.

# Configuración segura de SUTRAN

Los tokens SUTRAN se cifran con AES-256-GCM antes de guardarse en `tc_forward_servers.apikey`.
La clave de cifrado no debe almacenarse en el repositorio ni en la base de datos.

## Variable requerida

Habilite el uso de variables de entorno en Traccar:

```text
CONFIG_USE_ENVIRONMENT_VARIABLES=true
```

Configure una clave aleatoria de exactamente 32 bytes codificada en Base64:

```text
SUTRAN_ENCRYPTION_KEY=<clave-base64>
```

La salida real requiere además un interruptor global independiente. Su valor predeterminado es `false`:

```text
SUTRAN_TRANSMISSION_ENABLED=true
```

La transmisión solo ocurre si coinciden los tres controles: variable global habilitada, destino SUTRAN
habilitado y vehículo asignado a ese destino. Un destino JSON genérico nunca utiliza esta bandera.

En PowerShell puede generar una clave con:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

En Linux puede generarla con:

```bash
openssl rand -base64 32
```

Guarde la clave en el gestor de secretos o en la configuración protegida del servicio. No la publique,
no la registre en logs y no la incluya en respaldos junto con la base de datos.

## Operación

- Sin la clave, el backend rechaza la creación o actualización de destinos SUTRAN.
- Una clave diferente no puede descifrar tokens existentes.
- Perder la clave exige registrar nuevamente los tokens.
- La rotación requiere descifrar con la clave anterior y volver a cifrar con la nueva en una operación controlada.
- La API y la interfaz solo indican si existe una credencial; nunca devuelven el token ni el texto cifrado.

## Despliegue en VPS con systemd

Guarde las variables fuera del repositorio, por ejemplo en `/etc/traccar/sutran.env`, propiedad de `root`
y con permisos `600`:

```text
CONFIG_USE_ENVIRONMENT_VARIABLES=true
SUTRAN_ENCRYPTION_KEY=<clave-base64-estable>
SUTRAN_TRANSMISSION_ENABLED=false
```

Agregue al servicio de Traccar:

```ini
[Service]
EnvironmentFile=/etc/traccar/sutran.env
```

Ejecute `systemctl daemon-reload` y reinicie Traccar. La primera puesta en marcha aplica automáticamente
los changesets de Liquibase. Verifique el arranque antes de registrar el token.

### Archivos de esquema externos

Las instalaciones empaquetadas pueden cargar el esquema desde `/opt/traccar/schema` y no exclusivamente
desde el JAR. Antes de iniciar la versión nueva, respalde la base de datos y sincronice también:

```text
/opt/traccar/schema/changelog-master.xml
/opt/traccar/schema/changelog-sutran-forwarding.xml
```

Compruebe que el master externo incluya `changelog-sutran-forwarding.xml`. No edite
`databasechangelog` manualmente. Si los changesets ya existen, Liquibase los reconoce y no los repite.

### Alcance de reintentos y recuperación

Cada entrega se persiste como `PENDING` y debe guardar `PROCESSING` antes de iniciar HTTP. Si falla
ese guardado, no sale ninguna petición. Los
reintentos configurados por `maxAttempts` y `retryDelay` ocurren en memoria dentro de la misma ejecución.
En la instalación confirmada de una sola instancia, el arranque continúa las entregas `PENDING`.
Las `PROCESSING` pasan a `FAILED` con `errormessage=SUTRAN_ACKNOWLEDGEMENT_UNKNOWN`: son resultados
inciertos que requieren conciliación y nunca se reenvían automáticamente. Se conservan los demás
datos disponibles, sin inventar CRC, senttime ni intentos. La interfaz distingue esta anomalía.
Al agotar intentos queda `FAILED`; no existe un reintento diferido posterior de filas `FAILED`.

La columna `nextAttempt` está reservada para una futura planificación persistente y permanece nula con
la política actual. El CRC y `lastSent` se guardan cuando la respuesta es HTTP exitosa, contiene
`code=2000` o `code=2001` y un CRC no vacío. `2001` es una entrega histórica: no actualiza los datos
actuales de la placa. Ambos son terminales y no se reintentan. El CRC se conserva exactamente;
una longitud/formato distinto al documentado genera un aviso sin imprimir el valor.

Un acuse `2000`/`2001` sin CRC o con HTTP contradictorio queda como `REJECTED` por compatibilidad
de almacenamiento, con código y diagnóstico de anomalía terminal; no significa rechazo remoto.
La interfaz lo distingue con una advertencia y no reenvía. No se inventa un CRC ni se reclasifican
automáticamente entregas antiguas. La migración aditiva `changelog-sutran-crc.xml` amplía la columna
a texto para evitar truncar valores de longitud no documentada; `VARCHAR(6)` ya admitía cinco caracteres.

El despachador mantiene FIFO por dispositivo para encolar y por destino/placa para enviar. Mantiene
ocupada la segunda cola hasta terminar todos los reintentos de la entrega. Las placas distintas
pueden continuar y el callback GPS no espera HTTP. Se reutiliza el ejecutor administrado de Traccar;
no se crean hilos de aplicación adicionales. El cierre existente usa `shutdown`, sin garantía de
drenaje completo. Las colas son locales al proceso: no constituyen un bloqueo distribuido.

El orden es el de entrada, no una corrección de `time_device`: una posición atrasada recibida después
puede legítimamente obtener `2001`. La recuperación recorre páginas de 1000 filas por ID ascendente,
sin detenerse después de la primera página y sin usar offsets sensibles a cambios de estado.
Cada inicio de intento se guarda antes de HTTP; si falla ese registro, no se hace la llamada.
Un inicio registrado no prueba recepción remota y una caída puede dejar un acuse sin persistir.
Sin idempotencia remota no se puede garantizar entrega
exactamente una vez en esa ventana. La nueva recuperación bloquea su reenvío, incluso cuando la
caída pudo ocurrir antes de enviar: se prioriza evitar duplicados frente al reenvío a ciegas.

Los barridos se repiten cada 30 segundos. Reservan y releen cada entrega, excluyendo el trabajo
activo de esta instancia. Un fallo conocido anterior a HTTP conserva su turno por placa mientras
espera la recuperación de la base: las posiciones nuevas no lo adelantan. Los demás vehículos
pueden seguir. lastSent solo se publica después del acuse durable; si falla su actualización,
el indicador puede quedar atrasado y la entrega persistida es la evidencia autoritativa.

Este procedimiento está diseñado para una instancia. No es válido arrancar otra instancia contra
la misma cola: podría interpretar como interrumpido el trabajo activo de la primera. Si se cambia
esa topología, se requiere coordinación distribuida antes de habilitar SUTRAN en el segundo proceso.

En la primera actualización, revisar aparte las filas `PENDING` creadas por versiones antiguas:
esas versiones podían enviar aunque fallara el guardado de `PROCESSING`. No se puede demostrar
retroactivamente que ninguna de esas filas llegó al servicio. No se reclasifican automáticamente.

Antes de iniciar una entrega encolada se vuelve a leer la configuración del destino. Una desactivación
impide ese nuevo envío; una llamada o serie de reintentos ya iniciada conserva su configuración.
Retirar una asignación impide nuevos encolamientos tras la recarga administrativa, pero no elimina
entregas que ya estaban persistidas. No exponer los payloads de esas entregas en logs ni informes.

### Fuente de la placa

`plate` se obtiene exclusivamente de `Device.name`: se eliminan espacios laterales, se convierte a
mayúsculas y se exige exactamente seis caracteres alfanuméricos (`A-Z`, `0-9`). Los valores inválidos
se rechazan localmente y nunca se inventa ni se sustituye la placa.

## Piloto con un vehículo

1. Inicie con `SUTRAN_TRANSMISSION_ENABLED=false` y confirme que las funciones existentes operan normalmente.
2. Cree el destino SUTRAN en desarrollo, registre el token y mantenga desactivada su retransmisión.
3. Compruebe que el nombre del dispositivo sea la placa oficial de 6 caracteres y que `uniqueId` sea el IMEI
   de 15 dígitos.
4. Asigne exclusivamente el vehículo piloto al destino SUTRAN.
5. Cambie la variable global a `true`, reinicie Traccar y habilite la retransmisión del destino desde la interfaz.
6. Observe `Pendientes`, `Errores`, código de respuesta y CRC antes de ampliar el piloto.

Para detener inmediatamente las salidas, deshabilite el destino en la interfaz. Como corte independiente,
cambie `SUTRAN_TRANSMISSION_ENABLED=false` y reinicie el servicio. No elimine el destino: conservarlo mantiene
la trazabilidad de entregas y permite diagnosticar el incidente.

No reutilice la clave efímera del ambiente local ni copie el token en `traccar.xml`, Git, logs o comandos
que queden en el historial del shell.

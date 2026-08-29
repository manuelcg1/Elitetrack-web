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

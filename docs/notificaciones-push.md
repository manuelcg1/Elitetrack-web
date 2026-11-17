# Notificaciones push: formato nuevo y alarma de Salida 1

Plantillas en `templates/notifications/es/`:

| Archivo | Uso |
| --- | --- |
| `_comun.vm` | Variables compartidas: dispositivo, fecha y hora, ubicación, mapa, geocerca |
| `_pie.vm` | Pie del correo: enlace al evento y "Cancelar suscripción" |
| `alarm.vm` | Alarmas. Texto propio para `powerCut`, `powerRestored` e `input1On` (Salida 1); el resto usa la traducción `alarmXxx` |
| `deviceOverspeed.vm` | Exceso de velocidad. Respeta la unidad del usuario; la línea de geocerca solo aparece si el límite vino de una geocerca |
| `geofenceEnter.vm`, `geofenceExit.vm` | Ingreso y salida de geocerca |

El título del push es `$subject` y el cuerpo es `$digest`. El mismo `$digest` llega al aviso web,
a Telegram y a SMS; la parte HTML se usa en el correo.

## Requisitos en producción

1. **Idioma del servidor.** Traccar elige la carpeta de plantillas con el atributo `language`
   del servidor o del usuario. Si no existe, usa `en/` y nada de esto se aplica.
   En Ajustes → Servidor → Atributos debe existir un atributo con nombre `language` y valor `es`.
2. **Rutas reales de producción.** Traccar arranca en `/opt/traccar` con `/opt/traccar/traccar.xml`:
   - Web: `/opt/traccar/web` (`web.path` = `./web`). Nginx no sirve `/var/www/elitetrack`.
   - Plantillas: `/opt/traccar/templates/notifications` (valor por defecto de `templates.root`).
   - Traducciones del servidor: `/opt/traccar/templates/translations` (valor por defecto de `web.localizationPath`).
3. Las plantillas se leen en cada envío. Las traducciones del servidor se cargan una vez y
   necesitan reiniciar Traccar para tomar claves nuevas.

## Despliegue

`deploy.sh` publica en esas rutas:

```bash
cd /home/elitetrack/traccar
bash deploy.sh frontend    # web + plantillas, sin reiniciar Traccar
bash deploy.sh templates   # solo plantillas y traducciones
bash deploy.sh backend     # plantillas + JAR + reinicio de Traccar
```

Antes de reemplazar la web guarda `/opt/traccar/web-backup-deploy-AAAAMMDD_HHMMSS.tar.gz`
(conserva los 5 más recientes). Para volver atrás:

```bash
cd /opt/traccar && sudo rm -rf web/* && sudo tar -xzf web-backup-deploy-AAAAMMDD_HHMMSS.tar.gz
```

## Configuración por equipo FMC130

Estos son datos de la base, no código: `deploy.sh` no los copia. Se replican en cada entorno
con `tools/replicar_notificaciones.sh` (usa la API, es idempotente):

1. **Modelo `FMC130`** en el dispositivo. El decodificador de Teltonika solo convierte el
   IO 252 (Unplug Detection) en `alarm = powerCut` para modelos FMB/FMC. El modelo se toma
   cuando el equipo abre su conexión: basta con que se reconecte, no hay que reiniciar Traccar.
2. **Atributo calculado** `Salida 1 activada (alarma)`:
   - Atributo: `alarm` · Tipo: `Cadena`
   - Expresión: `(out1 ?? false) ? ((alarm ?? "") == "" ? "input1On" : alarm + ",input1On") : (alarm ?? null)`
   - Vigila la **salida DOUT1** (`out1`). La clave de la alarma sigue siendo `input1On`
     porque ya existe así en producción; el texto que ve el usuario es "Salida 1 activada".
   - No se repite mientras la salida siga activa porque `event.ignoreDuplicateAlerts`
     (activo por defecto) descarta una alarma que ya estaba en la posición anterior.
     Conserva las alarmas que manda el equipo, por ejemplo `powerCut,input1On`.
3. **Notificación** de tipo Alarma con "Energía desconectada" y "Salida 1 activada",
   vinculada a los mismos dispositivos.
   - Producción: canal `traccar` (Notificación Push).
   - Ensayo y local: canal `web`. Un canal que no está en `notificator.types` hace fallar
     todas las notificaciones del evento.

```bash
# Producción (desde tu PC o el VPS)
BASE_URL=https://app.elitetrack.site EMAIL=admin@elitetrack.site NOTIFICATOR=traccar ./tools/replicar_notificaciones.sh
# Ensayo (en el VPS)
BASE_URL=http://127.0.0.1:8083 EMAIL=admin@elitetrack.site NOTIFICATOR=web ./tools/replicar_notificaciones.sh
# Local (Git Bash)
BASE_URL=http://localhost:8082 EMAIL=admin NOTIFICATOR=web ./tools/replicar_notificaciones.sh
```

La contraseña se pide sin mostrarla. Requiere `jq`.

## Prueba sin el equipo

El FMC130 solo transmite a producción. En ensayo y local se prueba con OsmAnd:

| Entorno | Puerto OsmAnd | Dónde ejecutar |
| --- | --- | --- |
| Local | `5055` | Tu PC |
| Ensayo | `15055` (solo 127.0.0.1) | El VPS |

**En el VPS no uses `5055` ni `systemctl restart traccar` para pruebas:** son de producción.
El ensayo no es un servicio; se reinicia matando el PID de `/tmp/elitetrack-map-test.pid`
y volviéndolo a lanzar con `debug-ensayo.xml`.

```bash
PUERTO=5055   # 15055 en el ensayo
U="http://127.0.0.1:$PUERTO/?id=865124073074769&lat=-12.05&lon=-77.04"
curl -s "$U&out1=false"; sleep 3
curl -s "$U&out1=true"; sleep 3                  # → Salida 1 activada
curl -s "$U&out1=true"; sleep 3                  # → nada (no se repite)
curl -s "$U&out1=false&alarm=powerCut"           # → Desconexión de batería
```

No uses las plantillas de `prototipos/`: son una versión anterior, sin el pie del correo
y con km/h fijo. Las vigentes son las de `templates/notifications/es/`.

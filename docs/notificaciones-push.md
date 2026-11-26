# Notificaciones push: formato nuevo y alarma Jammer Detectado (Salida 1)

Plantillas en `templates/notifications/es/`:

| Archivo | Uso |
| --- | --- |
| `_comun.vm` | Variables compartidas: dispositivo, fecha y hora, ubicación, mapa, geocerca |
| `_pie.vm` | Pie del correo: enlace al evento y "Cancelar suscripción" |
| `alarm.vm` | Alarmas. Texto propio para `powerCut`, `powerRestored` e `input1On` (Jammer Detectado); el resto usa la traducción `alarmXxx` |
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
2. **Atributo calculado** `Jammer Detectado (Salida 1)`:
   - Atributo: `alarm` · Tipo: `Cadena`
   - Expresión: `(out1 ?? false) ? ((alarm ?? "") == "" ? "input1On" : alarm + ",input1On") : (alarm ?? null)`
   - Vigila la **salida DOUT1** (`out1`), que el FMC130 activa al detectar interferencia GNSS.
     La clave de la alarma sigue siendo `input1On` porque ya existe así en producción;
     el texto que ve el usuario es **"Jammer Detectado"**, sin el prefijo "Alarma"
     (`standaloneAlarms` en `web/src/common/util/formatter.js`).
   - No se repite mientras la salida siga activa porque `event.ignoreDuplicateAlerts`
     (activo por defecto) descarta una alarma que ya estaba en la posición anterior.
     Conserva las alarmas que manda el equipo, por ejemplo `powerCut,input1On`.
3. **Notificación** de tipo Alarma con "Energía desconectada" y "Jammer Detectado",
   vinculada a los mismos dispositivos.
   - Producción: canales `traccar,web` (Notificación Push + Web).
     - `traccar` envía el push al celular.
     - `web` envía el evento a la web: aviso emergente y lista de la **campana roja del
       mapa** (`EventsDrawer`). Al pulsar un evento se abre `/event/{id}` con el mapa en el
       punto donde se generó. Sin `web`, el push llega pero la campana queda vacía.
     - La campana conserva los eventos al recargar: al iniciar sesión la web carga del
       servidor los eventos de las últimas 24 horas que generan una notificación web para
       el usuario (máximo 50; `web/src/common/util/recentEvents.js`). Lo que el usuario
       borra de la campana se recuerda en su navegador y no vuelve a aparecer.
       El historial completo sigue en Reportes → Eventos.
   - Ensayo y local: canal `web`. Un canal que no está en `notificator.types` hace fallar
     todas las notificaciones del evento.
   - Si la notificación ya existe, el script le agrega los canales que falten sin quitar
     los que ya tenga.

```bash
# Producción (desde tu PC o el VPS)
BASE_URL=https://app.elitetrack.site EMAIL=admin@elitetrack.site NOTIFICATOR=traccar,web ./tools/replicar_notificaciones.sh
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
El ensayo no es un servicio; se reinicia deteniendo el proceso de `debug-ensayo.xml` y
volviéndolo a lanzar. Guarda el PID en `/tmp/elitetrack-map-test.pid`.

```bash
P="^java -jar target/tracker-server.jar debug-ensayo.xml"; cd ~/traccar-ensayo-sutran; mkdir -p logs; pkill -f "$P"; while pgrep -f "$P" >/dev/null; do sleep 1; done; nohup java -jar target/tracker-server.jar debug-ensayo.xml > logs/ensayo.out.log 2>&1 < /dev/null & echo $! > /tmp/elitetrack-map-test.pid; sleep 30; curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8083/; pgrep -af "$P"; cat /tmp/elitetrack-map-test.pid
```

Debe responder `200`, mostrar un solo proceso java y el mismo PID guardado. Funciona igual en
una terminal del VPS o enviado como `ssh elitetrack@64.227.27.188 '…'`. Evita estas variantes:

- Un patrón sin `^java` (por ejemplo `pkill -f "tracker-server.jar debug-ensayo.xml"`): enviado
  por `ssh`, también coincide con el `bash -c` que ejecuta el propio comando, así que `pkill`
  corta la conexión y deja el ensayo detenido, y `pgrep` nunca termina de esperar.
- Sin `< /dev/null`: la conexión `ssh` puede quedar abierta mientras java siga corriendo.
- `kill "$(cat /tmp/elitetrack-map-test.pid)"; sleep 5`: si el PID guardado no es el de java, o
  java tarda más de 5 s en cerrar, el proceso nuevo falla con `Address already in use` y el
  `200` lo sigue respondiendo el viejo.
- `cd … && nohup java … &`: el `&` manda al fondo toda la cadena como una subshell, y `$!`
  guarda el PID de la subshell, no el de java.

```bash
PUERTO=5055   # 15055 en el ensayo
U="http://127.0.0.1:$PUERTO/?id=865124073074769&lat=-12.05&lon=-77.04"
curl -s "$U&out1=false"; sleep 3
curl -s "$U&out1=true"; sleep 3                  # → Jammer Detectado
curl -s "$U&out1=true"; sleep 3                  # → nada (no se repite)
curl -s "$U&out1=false&alarm=powerCut"           # → Desconexión de batería
```

No uses las plantillas de `prototipos/`: son una versión anterior, sin el pie del correo
y con km/h fijo. Las vigentes son las de `templates/notifications/es/`.

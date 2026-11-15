# Notificaciones push: formato nuevo y alarma de Entrada 1

Plantillas en `templates/notifications/es/`:

| Archivo | Uso |
| --- | --- |
| `_comun.vm` | Variables compartidas: dispositivo, fecha y hora, ubicación, mapa, geocerca |
| `_pie.vm` | Pie del correo: enlace al evento y "Cancelar suscripción" |
| `alarm.vm` | Alarmas. Texto propio para `powerCut`, `powerRestored` e `input1On`; el resto usa la traducción `alarmXxx` |
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

## Configuración por equipo FMC130 (desde la web)

1. **Atributo calculado** (Ajustes → Atributos calculados):
   - Descripción: `Entrada 1 activada (alarma)`
   - Atributo: `alarm` · Tipo: `Cadena`
   - Expresión: `in1 == true ? (alarm ? alarm + ",input1On" : "input1On") : alarm`
   - Vincularlo a los dispositivos FMC130.

   No se repite mientras la entrada siga activa porque `event.ignoreDuplicateAlerts`
   (activo por defecto) descarta una alarma que ya estaba en la posición anterior.
   Conserva las alarmas que manda el equipo, por ejemplo `powerCut,input1On`.
2. **Notificación** de tipo Alarma con los subtipos "Energía desconectada" y
   "Entrada 1 activada", canal Notificación Push, vinculada a los mismos dispositivos.

## Prueba en local sin equipo

Con el servidor local (`debug.xml`, OsmAnd en el puerto 5055) y un dispositivo de prueba:

```bash
curl "http://127.0.0.1:5055/?id=IMEI&lat=-8.109&lon=-79.0187&speed=0&timestamp=$(date +%s)&in1=false"
curl "http://127.0.0.1:5055/?id=IMEI&lat=-8.109&lon=-79.0187&speed=0&timestamp=$(date +%s)&in1=true"
curl "http://127.0.0.1:5055/?id=IMEI&lat=-8.109&lon=-79.0187&speed=0&timestamp=$(date +%s)&in1=false&alarm=powerCut"
```

Resultado esperado: un aviso "Entrada 1" y uno "Desconexión de batería"; si se repite
`in1=true`, no hay un segundo aviso.

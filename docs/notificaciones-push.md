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
   En Ajustes → Servidor → Atributos debe existir `language = es`.
2. **Las plantillas no se copian con `deploy.sh`.** El script compila el JAR y el frontend,
   pero Traccar lee las plantillas de su propia carpeta (por defecto `/opt/traccar/templates`,
   o lo que diga `templates.root` en `/opt/traccar/conf/traccar.xml`).
3. Las plantillas se leen en cada envío: copiarlas no requiere reiniciar Traccar.

## Despliegue

```bash
cd /home/elitetrack/traccar
./deploy.sh frontend          # trae main y publica la web con la traducción alarmInput1On

grep -n "templates.root" /opt/traccar/conf/traccar.xml   # si no aparece, la ruta es /opt/traccar/templates
DEST=/opt/traccar/templates/notifications/es
sudo cp -a "$DEST" "$DEST.bak-$(date +%Y%m%d%H%M)"
sudo cp templates/notifications/es/{_comun,_pie,alarm,deviceOverspeed,geofenceEnter,geofenceExit}.vm "$DEST/"
```

Para volver atrás: copiar de nuevo los archivos desde la carpeta `.bak-…`.

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

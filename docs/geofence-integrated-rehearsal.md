# Ensayo integrado de asignación y consulta — 13/09/2026

## Alcance real

Se conectaron GeofenceAssignments y GeofencePanel reales con un servidor Jetty/Jersey
de ensayo que usa GeofenceResource, GeofenceFolderResource, PermissionsResource,
SecurityRequestFilter, LoginService, PermissionsService y DatabaseStorage reales.
La base es H2 en memoria con cuentas y geometrías sintéticas. No se sustituye fetch
por respuestas inventadas: la envoltura agrega Basic Auth de la cuenta seleccionada
y envía las solicitudes HTTP al servidor aislado mediante proxy local.

Esto valida la integración del flujo de permisos, no una instalación completa de
Traccar. CacheManager, auditoría y estadísticas son dobles de prueba del fixture.
No se iniciaron receptores GPS, WebSocket, Telegram, correo ni reenvíos. No se
ensayaron movimiento de vehículos ni propagación multinodo. Tampoco se probó
PostgreSQL con datos operativos en este ensayo.

## Recorrido comprobado en navegador

1. Usuario 1 con carpeta Parent asignada recibe solo geocerca 100, dentro de
   Parent → Child y marcada Heredado; no recibe geocerca 200 de Other.
2. Marcar la geocerca en el panel la muestra y enfoca en el mapa MapLibre.
   Se verificó visualmente el círculo. El mapa usa fondo local sin proveedor externo;
   la capa de dibujo del fixture usa geofenceToFeature real.
3. Como administrador se retiró Parent y se asignó Other en el mismo guardado.
   Al volver al usuario 1, la API entregó solo geocerca 200 con acceso heredado.
4. Como administrador se retiró Other y se asignó individualmente geocerca 100.
   Al volver al usuario 1, recibió solo 100, sin etiqueta Heredado y con sus
   carpetas de contexto Parent → Child.
5. Usuario 2 (solo lectura) consultó su geocerca 200; en su editor las casillas y
   Guardar quedaron deshabilitados.
6. Usuario 3 (sin menú) recibió HTTP 403; catálogo y visibilidad quedaron vacíos.

El cambio de cuenta del fixture utiliza credenciales sintéticas y metadatos de UI
conocidos; no equivale a probar la pantalla de login ni sesiones por cookies.
La revocación se verificó en la siguiente consulta, no como actualización push.

## Correcciones y hallazgos

- El fixture inicial no cargaba la paleta geometry que necesita el mapa. Se incorporó
  AppThemeProvider real y se repitió correctamente la visualización.
- GeofencePanel todavía usaba inputProps/InputProps retirados por la versión MUI
  instalada. Se cambiaron por slotProps: ahora las casillas exponen sus etiquetas
  accesibles y el buscador utiliza la configuración actual.
- El manejador de errores existente exponía trazas en respuestas 403. Se corrigió
  posteriormente en el cierre técnico del 13/09/2026; la regresión HTTP comprueba
  que devuelve Forbidden sin traza y con Cache-Control: no-store.
- Se observó un aviso CSS de orden de @import en el tema existente. No impidió el
  recorrido; no se alteró el tema productivo.

## Reproducción local

Con JAVA_HOME configurado para JDK 17, desde la raíz:

```powershell
.\gradlew.bat geofenceBrowserServer --init-script tools/validation/browser-server.gradle --console=plain
```

Esperar ISOLATED_BROWSER_BACKEND en la salida. En otra terminal:

```powershell
node tools/validation/integrated-ui.mjs
```

Abrir http://127.0.0.1:63118/build/integrated-ui/index.html.
El servidor escribe su puerto en build/geofence-browser-server.txt, escucha solo
en 127.0.0.1 y termina en 30 minutos o cuando se retira build/geofence-browser-running.
Detener Vite con Ctrl+C antes de compilar, porque build contiene el fixture temporal.
Los servicios de esta ejecución fueron detenidos después de las comprobaciones.

## Pendientes de aceptación productiva

Instalación completa con caché/sesiones reales, simulación GPS y cargas objetivo;
migraciones sobre copia actual autorizada y anonimizada; verificación de despliegue
backend antes de frontend. El respaldo antiguo
auditado permanece sin restaurar. No se modificó la base operativa ni se hizo push.

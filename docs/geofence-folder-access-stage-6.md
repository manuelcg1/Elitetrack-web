# Etapa 6: ensayos de interfaz y autorización

Fecha: 12 de septiembre de 2026.

## Pruebas realizadas en navegador

Se cargó el LinkField real, con sus hooks, traducciones y store, mediante Vite
aislado en 127.0.0.1:63117. El transporte y los datos fueron sintéticos.
No se inició la aplicación operativa ni se utilizó su API del puerto 8082.

| Escenario | Resultado observado |
| --- | --- |
| Alta normal | Una petición batch; selección y estado confirmado coinciden |
| Fallo antes del commit | Error visible; estado conservado; recarga al enfocar sin otra escritura |
| Respuesta perdida después del commit | Error visible; recarga muestra ambas asociaciones confirmadas; una sola escritura |
| Respuesta lenta de 5 segundos | Selector deshabilitado durante espera; vuelve a habilitarse tras guardar |
| Rechazo 403 | Error visible; estado confirmado no cambia |
| Advertencia posterior al commit | Conserva selección y muestra aviso traducido de guardado con advertencia |
| Limpiar dos asociaciones | Una sola petición con dos removals; estado final vacío |

Las comprobaciones se realizaron con interacciones y lectura del DOM en el
navegador. No son una suite E2E automatizada ni prueban autenticación de extremo
a extremo: el transporte de este entorno está simulado explícitamente.
El texto de errores anterior puede seguir visible en el panel diagnóstico del
ensayo, que muestra el último error del store; no representa una nueva respuesta.

## Backend real con datos sintéticos

Se repitieron 24 pruebas, cero fallos: GeofenceHttpAccessTest,
PermissionBatchResourceTest y ConnectionManagerPermissionsTest.
Incluyen autenticación, separación de usuarios, menú denegado, solo lectura,
lectura heredada sin delegación, rollback HTTP, revocación y usuario deshabilitado,
además de autorización completa previa al lote y concurrencia de las recargas.
El servidor HTTP usa recursos y filtro reales con H2 desechable; caché y auditoría
del fixture HTTP están simuladas. No equivale a probar todo el despliegue.

## Repetir el ensayo visual

Desde la raíz:

```powershell
node tools/validation/permission-ui.mjs
```

Abrir http://127.0.0.1:63117/build/permission-ui/index.html y elegir escenario.
El script copia el fixture a web/build/permission-ui; no cambia la entrada de la
aplicación ni su configuración Vite habitual. Usa puerto estricto y no configura
proxy; cualquier petición real a /api recibe 503. Detener con Ctrl+C.
Los archivos fuente del ensayo están en tools/validation/permission-ui.*.

## Pendientes para el ensayo con datos reales

Se solicitó la ruta de un respaldo autorizado y anonimizado. No se encontró ni
se tomó una copia operativa durante esta etapa. No se declara realizado ese ensayo.

Cuando se disponga del respaldo:

1. Registrar origen autorizado, versión PostgreSQL, formato, fecha y hash del archivo.
2. Revisar que no incluya credenciales, destinos de notificación, identificadores
   personales ni coordenadas reales innecesarias; no iniciar servicios antes de ello.
3. Restaurar en una base nueva del clúster aislado, nunca sobre la operativa.
4. Comparar datos y relaciones antes y después de migrar; revisar duplicados,
   huérfanos, ciclos y relaciones individuales y heredadas.
5. Arrancar un backend de ensayo con salidas de notificación y reenvío desactivadas,
   junto al frontend aislado; probar cuentas sintéticas de administrador, usuario,
   solo lectura y sin menú. Esta prueba integrada todavía está pendiente.
6. Acordar volumen objetivo de usuarios, vehículos y actualizaciones por segundo
   para medir p95/p99 y fijar criterios de aceptación antes del despliegue.

No hubo cambios funcionales en producción, migraciones operativas ni despliegue.

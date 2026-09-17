# Cierre de validación local — 13/09/2026

La mejora permite asignar carpetas y geocercas individuales en una operación
transaccional y consultar la jerarquía autorizada. La herencia concede lectura;
no concede edición ni delegación. La implementación y las pruebas locales están
completadas en el alcance descrito aquí. La aceptación productiva sigue pendiente:
este documento no certifica ausencia de riesgos ni autoriza un despliegue.

## Corrección final

ResourceErrorHandler ya no envía excepciones, causas, SQL ni trazas en el cuerpo
HTTP. Conserva los códigos existentes, usa mensajes públicos controlados y conserva
cabeceras como Retry-After. Elimina las cabeceras de longitud y codificación del
cuerpo sustituido y marca la respuesta no-store. Los detalles quedan en el registro
del servidor, cuyo acceso debe seguir restringido.

El cambio afecta los errores de toda la API: los clientes conservan el código HTTP
y texto plano, pero dejan de recibir el mensaje técnico anterior. Las denegaciones
de escritura conservan Write access denied. No se cambió la política histórica
que devuelve 400 para excepciones que no son WebApplicationException.

## Evidencia ejecutada

- Suite completa Gradle: 714 pruebas descubiertas, 683 ejecutadas, 31 omitidas,
  cero fallos y cero errores. XML conservados en
  build/reports/geofence-closeout-evidence. Las omisiones incluyen cinco pruebas
  PostgreSQL que requieren configuración explícita; no se cuentan como aprobadas
  en esta ejecución. El ensayo PostgreSQL anterior está documentado en la etapa 5.
- Después de reforzar la aserción HTTP: cuatro pruebas del manejador y seis pruebas
  HTTP reales de geocercas aprobadas. Comprueban también que una denegación por menú
  devuelve exactamente Forbidden y no-store.
- Nueve pruebas Node aprobadas: herencia, eliminación de padre conservando permisos
  explícitos, árboles inválidos, lote único, proyección autorizada y fallo de guardado.
- ESLint aprobado en los siete archivos frontend de la mejora; compilación Vite
  aprobada. Registro: build/reports/geofence-closeout-web-build.log.
- Checkstyle aprobado en los catorce archivos Java de producción de la mejora.
  No equivale a certificar el estilo de todo el repositorio.
- El ensayo anterior con navegador, API real y H2 sintética está descrito en
  geofence-integrated-rehearsal.md. No se repitió como instalación completa.

git diff --check detecta un espacio final en web/src/Navigation.jsx:175, fuera de
los cambios propios de esta mejora. Se preservó ese cambio ajeno.

## Condiciones que impiden cerrar producción

| Condición pendiente | Comprobación necesaria |
| --- | --- |
| Datos reales actuales | Copia autorizada y anonimizada, migración y restauración en instancia aislada. El respaldo antiguo auditado sigue excluido. |
| Instalación completa | Login y sesiones reales, receptores GPS simulados y WebSocket con revocación, desconexión y reconexión; salidas externas deshabilitadas. |
| Capacidad representativa | Definir usuarios concurrentes, vehículos, geocercas y frecuencia GPS; medir latencia y errores con ese volumen. El ensayo sintético no establece capacidad productiva. |
| Despliegue | Verificar en preproducción backend antes de frontend, respaldo reciente y recuperación ensayada antes de habilitar la mejora. |

## Límites conocidos

- El panel del destinatario actualiza permisos al consultar o recargar; no recibe
  revocaciones visuales inmediatas por push.
- La transacción protege las asociaciones SQL. La recarga de caché y auditoría
  ocurre después del commit; un fallo no revierte la asignación. Los avisos de
  actualización pendiente no son una confirmación durable entre nodos.
- La propagación multinodo y el rendimiento del editor con catálogos grandes
  no están certificados. No se añadió virtualización del listado.
- El ensayo integrado emplea dobles de caché y auditoría; las pruebas unitarias
  de concurrencia no sustituyen un ensayo con la instalación completa.

No se modificó la base operativa, no se restauró el respaldo antiguo y no se hizo
commit, push ni despliegue. Para cerrar producción se necesitan los datos de ensayo
y objetivos de carga indicados; no es correcto dar esas comprobaciones por hechas.

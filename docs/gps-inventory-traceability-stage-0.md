# Trazabilidad de Inventario GPS — Etapa 0

Fecha de línea base: 2026-08-13  
Rama: `main`  
Commit base: `d63bcf3`

## Objetivo

Establecer una referencia verificable antes de agregar fechas, asignaciones, retiros,
revisiones técnicas o bajas al Inventario GPS. Esta etapa no modifica el esquema de
base de datos, contratos REST ni la identificación operativa de los dispositivos.

## Alcance funcional actual

- El identificador operativo de recepción es `tc_devices.uniqueid` (`Device.uniqueId`).
- El activo físico del inventario usa `tc_gps_inventory.imei` (`GpsInventory.imei`).
- No existe sincronización automática entre ambos campos.
- `tc_gps_inventory.deviceid` conserva solamente la relación actual y utiliza
  `ON DELETE SET NULL` al eliminar un dispositivo.
- El inventario no tiene fechas de creación, actualización, asignación, retiro o baja.
- El CRUD genérico genera acciones `create`, `edit` y `remove` en `tc_actions`, pero
  no conserva valores anteriores/nuevos ni constituye un historial de ciclo de vida.
- La interfaz navega a `/monitoring/gps-inventory/{id}/history`, pero la ruta, página
  y API de historial aún no existen.
- La migración activa del inventario está integrada en
  `schema/changelog-6.13.1.xml` y consta como ejecutada en Liquibase. Existe además
  `schema/changelog-6_13-gps-inventory.xml`, que no está incluido en el maestro y no
  debe incorporarse porque duplicaría identificadores de cambios ya aplicados.

## Contratos que deben permanecer compatibles

| Método | Ruta | Comportamiento actual |
| --- | --- | --- |
| GET | `/api/gps-inventory` | Lista los activos permitidos al usuario |
| GET | `/api/gps-inventory/{id}` | Devuelve un activo permitido |
| POST | `/api/gps-inventory` | Registra IMEI, marca, modelo, serie, estado y notas |
| PUT | `/api/gps-inventory/{id}` | Reemplaza los datos editables del activo |
| DELETE | `/api/gps-inventory/{id}` | Elimina físicamente el activo |
| GET | `/api/devices` | Lista dispositivos e identificadores operativos |
| POST | `/api/devices` | Crea un dispositivo con `uniqueId` único |
| PUT | `/api/devices/{id}` | Permite modificar el `uniqueId` operativo |

Durante las primeras etapas no se cambiarán rutas, códigos HTTP ni campos existentes.
Las nuevas propiedades deberán ser aditivas y tolerar registros históricos sin fecha.

## Resultado de validaciones

### Base de datos local

- Motor: PostgreSQL 18.3.
- `tc_devices`: 17 registros.
- `tc_gps_inventory`: 1 registro.
- Inventarios vinculados a dispositivo: 0.
- Inventarios sin vínculo: 1.
- IMEI con formato inválido: 0.
- Relaciones cuyo IMEI difiere del `uniqueId`: 0.
- Inventarios sin vínculo con coincidencia exacta en dispositivos: 0.
- Dispositivos sin registro correspondiente en inventario: 17.
- Estados observados: `en_almacen` (1).
- Columnas de fecha de ciclo de vida en inventario: 0.
- Cambios Liquibase de Inventario GPS ejecutados: 10.
- Permisos directos usuario–inventario: 1; permisos grupo–inventario: 0.
- Las claves foráneas a dispositivo y grupo están activas.
- El IMEI tiene una restricción única y también un índice explícito con las mismas
  columnas. PostgreSQL mantiene dos índices equivalentes; antes de agregar índices
  nuevos debe evaluarse esta redundancia, sin retirarla durante la etapa aditiva.

Las consultas fueron ejecutadas dentro de una transacción `READ ONLY`.

### Respaldo y restauración

- Formato: archivo personalizado de PostgreSQL (`pg_dump -Fc`).
- Ubicación local, excluida del control de versiones:
  `target/stage0-backup/traccar-stage0-20260813.dump`.
- Tamaño: 773,652 bytes.
- SHA-256:
  `AB8E8FFE97BD00309E25ABFE2F61F1B1D66F6F81D9522706B6532D23BAE019BB`.
- El catálogo del respaldo fue leído correctamente por `pg_restore --list`.
- Se restauró completamente en la base temporal
  `traccar_stage0_restore_20260813`.
- La restauración conservó 17 dispositivos, 1 activo de inventario y 95 registros
  de Liquibase.
- La base temporal fue eliminada después de validar los conteos; el archivo de respaldo
  se conserva para la siguiente etapa.

Este respaldo corresponde al entorno local auditado. Antes de desplegar en producción
se requiere repetir el mismo procedimiento sobre la base productiva o su réplica.

### Comprobación HTTP local

- `GET /api/server`: HTTP 200.
- `GET /api/gps-inventory` sin sesión: HTTP 401, comportamiento de seguridad esperado.
- El servicio local escucha en el puerto 8082.

### Backend

Comando: `gradlew.bat test`

- 604 pruebas ejecutadas.
- 574 aprobadas.
- 4 fallidas.
- 26 omitidas.

Fallos de línea base:

1. `AlertNotificationServiceTest.testTelegramMessageWithPositionAndGeofence`
2. `AlertNotificationServiceTest.testTelegramAlertTypeLabels`
3. `TelegramIntegrationResourceTest.testGroupChatIdRejected`
4. `TelegramIntegrationResourceTest.testChatIdMasking`

Tres fallos muestran expectativas con texto mal codificado frente a texto UTF-8
correcto. El cuarto corresponde a una aserción de contenido de mensaje de Telegram.
No están relacionados con Inventario GPS, pero deben conservarse como fallos conocidos
para no atribuirlos a la futura implementación.

Reporte generado localmente: `build/reports/tests/test/index.html`.

### Frontend

Comando: `npm run build`

- Compilación productiva aprobada.
- 2,093 módulos transformados.
- Advertencias no bloqueantes por tamaño de chunks y una opción obsoleta del plugin.

Comando: `npm run lint`

- 89 errores.
- 40 advertencias.
- La mayoría de errores bloqueantes observados están en
  `web/src/settings/DeviceRetentionPage.jsx` y corresponden a formato Prettier previo.

Estos defectos no deben corregirse dentro de la etapa de trazabilidad para evitar
mezclar alcances. Las validaciones futuras deben comparar resultados contra esta línea
base y exigir cero fallos nuevos.

## Estado local previo

Antes de iniciar esta etapa ya existían cambios sin confirmar en:

- `src/main/java/org/traccar/forward/CatalogPositionForwarder.java`
- `web/src/common/components/StatusCard.jsx`
- `web/src/map/MapPositions.js`
- `web/src/map/SmartVehicleMarker.css`
- `web/src/map/SmartVehicleMarker.js`
- `web/src/map/draw/MapGeofenceEdit.js`
- `web/src/reports/PositionsReportPage.jsx`
- `web/src/reports/components/ReportMapSplit.jsx`

No deben incluirse ni alterarse accidentalmente en las etapas de Inventario GPS.

## Puerta de entrada a la Etapa 1

Antes de aplicar una migración se debe:

1. Obtener un respaldo verificable de la base productiva o de su clon de ensayo. El
   respaldo local ya fue generado y validado.
2. Restaurar ese respaldo en un entorno aislado y comprobar que inicia. La restauración
   local y sus conteos ya fueron verificados.
3. Consultar conteos de `tc_devices`, `tc_gps_inventory` y coincidencias IMEI/uniqueId.
4. Detectar inventarios sin dispositivo, relaciones inconsistentes y estados inválidos.
5. Ejecutar la migración aditiva primero sobre el clon.
6. Repetir backend tests, frontend build y lint, aceptando solo los fallos conocidos.
7. Confirmar que no cambian las respuestas de las APIs enumeradas arriba.

No se debe usar `lastUpdate` como fecha de registro. Tampoco se deben inventar fechas
históricas; una fecha inferida deberá marcarse explícitamente como estimada.

## Criterio de regresión

Una etapa se considera fallida si:

- aumenta el número de pruebas backend fallidas;
- deja de compilar el frontend;
- agrega errores de lint en archivos modificados por la etapa;
- cambia un contrato REST existente sin compatibilidad;
- modifica `tc_devices.uniqueid` fuera del flujo de sincronización aprobado;
- afecta recepción de posiciones, caché, sesiones, reportes, alertas o reenvíos.

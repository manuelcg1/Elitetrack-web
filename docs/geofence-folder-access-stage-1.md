# Acceso a geocercas por carpetas: etapa 1

## Objetivo

Versionar la relación explícita usuario–carpeta que ya existe en la base local y
establecer pruebas antes de ampliar los permisos. Esta etapa no activa herencia,
no modifica la interfaz y no crea asignaciones para usuarios.

## Cambios

- Nueva migración `schema/changelog-geofence-folder-permissions.xml`, incluida al
  final del changelog principal. No se editan las migraciones históricas.
- Creación de `tc_user_geofencefolder` donde falte, clave primaria compuesta,
  referencias a usuarios y carpetas e índices para búsquedas por carpeta y padre.
- Validación previa de identificadores nulos, duplicados y referencias huérfanas.
  Los datos inválidos detienen la migración; no se eliminan ni corrigen solos.
- Conservación de las asignaciones individuales en `tc_user_geofence`.
- Pruebas en bases H2 desechables y pruebas del comportamiento actual de permisos.

Los tipos de las tablas existentes no se alteran. Una instalación nueva utiliza
INT, como los identificadores de las migraciones históricas. La base local tiene
BIGINT en carpetas y en usuario–carpeta; su normalización queda fuera de esta etapa.
Las restricciones con los nombres convencionales ya existentes se conservan.
Un esquema externo con restricciones distintas requiere revisión antes del despliegue.

## Contrato que debe mantener la siguiente etapa

1. Asignar una carpeta permitirá consultar sus descendientes actuales y futuros.
2. Las asignaciones individuales y las de carpeta se guardarán por separado.
3. Retirar una carpeta no retirará asignaciones individuales ni otras fuentes de acceso.
4. Consultar por herencia no concederá edición, eliminación ni delegación.
5. Los padres mostrados como contexto no concederán acceso a hermanos ni a metadatos privados.
6. Las asociaciones de vehículos, grupos de vehículos y alertas permanecerán independientes.
7. La retirada de permisos actualizará listados, comprobaciones por ID y conexiones activas.

No se debe habilitar la herencia cambiando indiscriminadamente `checkPermission`:
el CRUD actual también utiliza esa comprobación antes de escribir o eliminar.

## Auditoría local de partida

Consulta de solo lectura sobre PostgreSQL 18.3, realizada el 8 de septiembre de 2026:

- 5 carpetas, 213 geocercas, 4 relaciones usuario–carpeta y 213 individuales.
- Sin ciclos, padres inexistentes, geocercas huérfanas o duplicados detectados.
- Las asignaciones de carpeta pertenecen a un solo administrador. Los 211 accesos
  que resultarían heredados ya existen individualmente: esto no prueba la herencia.
- Sin asociaciones vehículo–geocerca ni grupo de vehículos–geocerca; existen
  alertas personalizadas que deben probarse por separado del flujo nativo.
- La base registra cambios de `changelog-local-alerts.xml` ausente del repositorio.
  Esta etapa no borra ese historial ni declara reconciliadas todas las diferencias.

## Validación

Desde la raíz, con el JDK del proyecto:

```powershell
.\gradlew.bat test --tests org.traccar.storage.GeofenceFolderMigrationTest --tests org.traccar.api.security.GeofencePermissionBaselineTest --tests org.traccar.forward.sutran.SutranMigrationTest --tests org.traccar.handler.events.GeofenceEventHandlerTest --tests org.traccar.alert.AlertGeofenceStateManagerTest
```

Estas pruebas no leen `debug.xml` ni conectan con PostgreSQL local. El caso de
migración completa utiliza el changelog principal en H2. No sustituye una prueba
de actualización y restauración de una copia PostgreSQL.

Resultado de esta etapa: compilación Java correcta y 19 pruebas aprobadas, sin
fallos ni errores. Incluyen consultas SQL reales de permisos para dos usuarios,
migración completa en H2, actualización de una relación existente, repetición de
migración y regresiones de eventos de geocercas.

La compilación inicial detectó una referencia residual a `PLANNER` en
`MenuKeys.ALL`, sin constante declarada. Se retiró esa referencia para recuperar
la compilación, sin habilitar el módulo Planificador.

## Puerta de salida hacia producción

- Respaldo y restauración comprobados en un entorno separado.
- Migración ensayada en PostgreSQL sobre instalación limpia y copia del esquema existente.
- Revisión del SQL generado y de cualquier bloqueo durante la creación de índices.
- Casos con usuarios no administradores antes de activar la herencia.
- No iniciar Traccar contra la base operativa solo para probar: el arranque ejecuta migraciones.

## Reversión

Esta etapa añade estructura, no convierte asignaciones. Para volver a la versión
anterior, conservar las tablas y los datos nuevos mientras se verifica compatibilidad.
No ejecutar un rollback destructivo genérico: podría eliminar una tabla que existía
antes de esta migración. Si se requiere restaurar la base, usar el respaldo ensayado.

## Siguiente etapa

Implementar un servicio de acceso efectivo de consulta, validación de jerarquías y
pruebas de aislamiento entre usuarios. Después integrar invalidaciones y, finalmente,
el selector jerárquico con guardado transaccional. Cada etapa debe pasar sus pruebas
antes de habilitar comportamiento nuevo para los usuarios.

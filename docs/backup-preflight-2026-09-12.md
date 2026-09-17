# Revisión previa del respaldo

Archivo: backups/traccar-pre-sutran-20260828-162624.backup.
SHA-256: B42AEFD9CD9FFFC50C90AFCD7E3371C487BEBCC93C28162D00C98DEEA974A59D.

## Dictamen

No usar directamente con la aplicación actual ni restaurar sobre la base operativa.
No se restauró ni se ejecutó SQL del archivo. Se leyó el esquema y se decodificó
el archivo completo a NUL; algunos datos se procesaron en memoria para producir
estadísticas, sin mostrar nombres, ubicaciones ni credenciales.

## Hallazgos

- Archivo CUSTOM de PostgreSQL 18.3, creado el 28/08/2026; decodificación completa
  sin error. Esto no sustituye una restauración verificada.
- Faltan las columnas y tablas de la migración SUTRAN que espera el código actual;
  no existen entradas SUTRAN en el historial del respaldo. Arrancar sin migrar
  puede producir errores SQL. No se validaron los checksums con Liquibase.
- Hay 3 configuraciones de reenvío: 2 activas y las 3 con contraseña o API key
  no vacía. No es una copia anonimizada apta para arrancar servicios de ensayo.
  No se efectuó ninguna transmisión.
- tc_user_geofencefolder ya tiene BIGINT, clave primaria y referencias a usuarios
  y carpetas. Sus 4 asociaciones no tienen duplicados.
- Las 213 asociaciones individuales no tienen duplicados.
- Las 5 carpetas no tienen ciclos ni rutas con padres ausentes.
- No hay historial de la nueva migración geofence-folder-permissions. Sus
  precondiciones contemplan tablas y claves existentes y preservan BIGINT;
  la compatibilidad con estos datos sigue pendiente de ejecución aislada.

## Requisitos antes de reconsiderarlo

Preparar una copia local restringida, anonimizar datos y credenciales y neutralizar
salidas de alertas, notificaciones y reenvíos antes de iniciar la aplicación.
Ensayar migraciones y checksums en una base nueva con un plan de comparación de
relaciones y permisos. La revisión estática no prueba que todas las funciones
continúen operando ni que los datos representen el estado operativo actual.
Mientras esas condiciones no se cumplan, seguir usando los fixtures sintéticos.

Revisión reproducible: tools/validation/Inspect-Backup.ps1.
Evidencia resumida: build/reports/backup-preflight.json.
No se modificó el respaldo, el código funcional ni la base operativa.

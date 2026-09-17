# Etapa 5: transacciones, rendimiento y PostgreSQL aislado

## Alcance y comportamiento

El selector de conexiones envía sus altas y bajas juntas mediante
`POST /api/permissions/batch`. Se autorizan todos los elementos antes de escribir.
DatabaseStorage usa una sola conexión y transacción: un fallo SQL revierte todo
el lote, incluidas las bajas anteriores. Los endpoints individuales y bulk
existentes también utilizan este contrato. Máximo: 10000 cambios por petición;
se rechazan identificadores inválidos y cambios duplicados o contradictorios.

Ejemplo del cuerpo:

```json
{
  "additions": [{"userId": 1, "geofenceId": 200}],
  "removals": [{"userId": 1, "geofenceId": 100}]
}
```

La interfaz impide cambios simultáneos en el mismo selector y actualiza la
selección al recibir éxito. Ante un error descarta su copia local y vuelve a
consultarla al enfocar el campo: una respuesta perdida puede ocurrir después
del commit. No reintenta mediante escrituras independientes.

Las recargas locales se agrupan por usuario afectado; un lote de 100 relaciones
del mismo usuario provoca una sola recarga. Las consultas siguen fuera del
bloqueo global de envío y las generaciones impiden publicar resultados obsoletos.

## Evidencia de validación (12 de septiembre de 2026)

- Regresión seleccionada: 95 pruebas, cero fallos y cero omitidas. Incluye 5
  pruebas PostgreSQL, HTTP real, autorización, alertas, sesiones y migraciones.
- Después del ajuste exclusivo de formato: recompilación Java, contrato
  transaccional H2 y Checkstyle de 13 archivos de producción aprobados.
- Frontend: 3 pruebas Node aprobadas, ESLint de los dos componentes modificados
  aprobado y compilación Vite/PWA aprobada. Persisten avisos sobre chunks grandes
  y la opción esbuild del plugin; no se alteró esa configuración.
- Actualización de un usuario no afectado durante SQL bloqueado: 2 ms en esta
  ejecución. Es una comprobación de concurrencia, no un SLA.
- PostgreSQL sintético: 20 usuarios, 10000 geocercas, 4 trabajadores;
  total 2275,13 ms, mediana 433,13 ms, p95 539,47 ms, máximo 588,69 ms.
  PGSimpleDataSource abre conexiones por consulta, sin pool: no extrapolar a
  capacidad productiva ni comparar directamente con la medición secuencial H2.

Los XML de las 95 pruebas se conservaron en
`build/reports/geofence-stage5-evidence`. La medición está en
`build/reports/geofence-postgres-load.json`.

## Aislamiento y restauración

Se utilizó PostgreSQL 18 en un directorio exclusivo dentro de build, enlazado
solo a 127.0.0.1:62742, con datos sintéticos y un marcador de validación.
No se utilizó la conexión de la aplicación ni su base operativa.

Se ensayaron migración completa y repetición, relaciones antiguas BIGINT,
rechazo de duplicados sin pérdida y rollback transaccional real.
Una migración histórica de alertas consulta information_schema sin filtrar
esquema; repetir instalaciones completas en varios esquemas de la misma base
produce interferencias. La instalación completa se prueba ahora en una base
nueva por ejecución. No se modificó el historial Liquibase aplicado. El uso
productivo de varios esquemas requiere una auditoría específica previa.

`tools/validation/Restore-GeofenceValidation.ps1` verifica directorio, puerto
y marcador antes de pg_dump, crea un destino nuevo y ejecuta pg_restore.
Compara filas mediante conteos y hashes, definición y orden lógico de columnas,
restricciones, índices y secuencias. El orden lógico excluye los huecos internos
que dejan las columnas eliminadas, pues pg_dump no conserva esos huecos.
El resultado se registra en `build/reports/geofence-postgres-restore.json`.
El ensayo final aprobó: 194 tablas y 2226 entradas coincidentes; ambos manifiestos
tienen SHA-256 BA0CBD2E3DF227E59EC9D4D323CB2A9E665AFA469653788A35ACA865508A2E35.
El destino fue geofence_restored_0d64ae11 y se confirmó el apagado del servidor.
El script detiene únicamente el clúster aislado al finalizar y conserva archivos.

## Límites y siguiente paso de producción

- La atomicidad cubre un lote de un selector, no toda la pantalla Conexiones.
- La caché, la difusión y la auditoría ocurren después del commit. Fallos
  detectados devuelven 204 con X-Permission-Refresh o X-Permission-Audit en
  pending y aviso en la interfaz. El valor complete no es una confirmación
  durable de entrega a otros nodos. No hay outbox transaccional.
- La difusión entre nodos conserva mensajes por relación; no se ha validado
  carga multinodo. La autorización previa tampoco serializa una revocación
  concurrente realizada por otro administrador.
- Los Storage alternativos sin implementación transaccional rechazan el lote;
  no existe una degradación silenciosa a escrituras parciales.
- El ensayo de restauración es sintético, no una copia de la base operativa.
  Antes de desplegar: ensayar una copia autorizada y anonimizada, probar la
  interfaz en navegador con roles reales de prueba y acordar carga objetivo.
- Desplegar backend compatible antes del frontend. No se desplegó ni se aplicó
  una migración sobre la base operativa durante esta etapa.
- Quedan fuera de este cierre el selector visual jerárquico y el endurecimiento
  de las respuestas antiguas que exponen trazas de error.

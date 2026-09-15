# Ensayo PostgreSQL de la migración CRC SUTRAN

Se utilizó exclusivamente el clúster PostgreSQL 18 de validación en 127.0.0.1:62742,
base geofence_validation, protegido por comprobación de nombre y marcador de instancia.
No se consultaron credenciales de SUTRAN ni la base de localhost:5432. El clúster fue
detenido después del ensayo. No hubo despliegue, commit, push ni tráfico a SUTRAN.

## Comprobaciones aprobadas

PostgresGeofenceValidationTest ejecutó dos pruebas, sin fallos ni omisiones:

1. Migración específica sobre tabla sintética con columna VARCHAR(6), CRC de cinco y
   seis caracteres, y una fila histórica REJECTED/2001 sin CRC. La columna quedó como
   text, los valores permanecieron exactos y la fila histórica no fue reclasificada.
   Se insertó y recuperó un CRC sintético de más de seis caracteres. Aplicar la
   migración dos veces conservó un solo registro en databasechangelog.
2. Instalación del master completo en otra base vacía aislada, seguida de una segunda
   aplicación sin cambios adicionales. Esto verifica compatibilidad del nuevo include.

XML: build/reports/sutran-postgres-evidence/TEST-org.traccar.storage.PostgresGeofenceValidationTest.xml.

## Respaldo y restauración

Restore-GeofenceValidation.ps1 respaldó la base aislada y la restauró en una base
nueva del mismo clúster. Comparó 197 tablas y 2264 entradas del manifiesto: contenido,
columnas, restricciones, índices y secuencias. Ambos manifiestos coincidieron:

`453C4F2D6FEA2A245169AD30B0AEDED0FED35E9C85610EB74D813FA6C8DF2804`

Informe: build/reports/geofence-postgres-restore.json. El script usa el nombre histórico
de validación de geocercas, pero incluye también el esquema sintético SUTRAN creado
durante este ensayo. No es una restauración de datos operativos.

El script completó la comparación, pero el sandbox impidió enviar la señal de cierre.
Se verificó nuevamente la identidad y puerto del clúster y se detuvo con la elevación
autorizada. La parada final terminó correctamente.

## Recuperación paginada

La prueba con 1001 entregas reprodujo el límite anterior de 1000. SutranDeliveryQueue
se cambió a lectura por páginas con cursor ID ascendente; las actualizaciones de
estado por callbacks no desplazan filas como sucedería usando offsets. Esto elimina
el límite total por arranque, pero no establece un límite de memoria de la cola asíncrona.
Regresión posterior: 43 pruebas SUTRAN/catálogo/pipeline aprobadas, sin fallos ni
omisiones; Checkstyle aprobado. XML en build/reports/sutran-recovery-evidence.

## Cierre de la decisión de operación

- El usuario confirmó una sola instancia de Traccar. La coordinación multinodo no
  aplica al despliegue autorizado; no se incorporaron leases ni bloqueos distribuidos.
- La recuperación se corrigió: un PROCESSING se conserva como anomalía terminal FAILED
  con marcador SUTRAN_ACKNOWLEDGEMENT_UNKNOWN. No se reenvía; requiere conciliación.
  Un PENDING continúa. Antes de enviar HTTP es obligatorio confirmar el guardado de
  PROCESSING; una excepción de almacenamiento impide el envío.
- Una garantía de exactamente una entrega necesita idempotencia o consulta de
  conciliación de SUTRAN. No puede deducirse únicamente de la base local. No se ha
  consultado el servicio remoto para obtener esa capacidad.

La migración está validada en PostgreSQL sintético. Esto no certifica el tiempo de
bloqueo de la tabla bajo carga productiva. El diseño no admite una segunda instancia
transmisora sin revisión. Ver sutran-single-instance-recovery.md para el cierre y sus límites.

# Auditoría y corrección local SUTRAN V2

## Resumen y causa raíz

La aclaración contractual entregada por el usuario define `2000` como registrado y actualizado,
y `2001` como registrado históricamente sin actualizar el estado actual de la placa. Ambos son éxito.
La implementación anterior reconocía exclusivamente `2000` y exigía `[0-9A-Za-z]{6}`. El caso `2001`
caía en el retorno REJECTED con CRC nulo y result como mensaje; la cola persistía ese mensaje en
errormessage. El DTO no truncaba ni validaba el CRC. El fallo estaba en SutranDeliveryResult.classify.

El código anterior NO reintentaba una respuesta 2001 ya recibida: SutranClient.finish solo reintenta
RETRY. Una fila con attempts=2 no demuestra que las dos respuestas fueran 2001. Puede incluir un
timeout/5xx anterior o recuperación. Sí se reintentaba erróneamente 2000 con CRC distinto de seis
caracteres. No se consultaron datos ni logs operativos para intentar reconstruir esa historia.

No se encontró evidencia de error de zona horaria. SutranPayloadMapper y la conversión temporal
no se modifican. No se enviaron peticiones a SUTRAN ni se activó su interruptor.

## Reglas nuevas

| Respuesta | Persistencia y acción |
| --- | --- |
| HTTP 2xx, 2000, CRC no vacío | DELIVERED, código 2000, CRC exacto, senttime, sin error ni reintento. |
| HTTP 2xx, 2001, CRC no vacío | DELIVERED, código 2001, CRC exacto, senttime, sin error ni reintento; UI histórica. |
| 2000/2001 sin CRC o HTTP contradictorio | REJECTED como anomalía terminal del acuse, conserva código/CRC disponible y mensaje controlado. No reintenta. UI con advertencia, no rechazo remoto. |
| 4001–4004, 5001–5003 | Rechazo funcional/autorización terminal. No se convierte en transitorio por el envoltorio HTTP. |
| Timeout/conexión, 408, 429, HTTP 5xx sin código terminal | RETRY con backoff limitado; FAILED al agotar intentos en la cola. |
| HTTP 2xx sin cuerpo interpretable | Nunca se considera entrega; conserva política de reintentos limitada. |

No se persiste el texto remoto arbitrario result como error: puede repetir datos sensibles. Los
mensajes técnicos nuevos son constantes o incorporan únicamente código HTTP/código funcional.
Las advertencias CRC contienen código y longitud, nunca token, placa, IMEI, CRC ni payload.

## Orden, pipeline y recarga

Antes, SutranDeliveryQueue.send comenzaba cada llamada sin exclusión por placa. Un HTTP asíncrono
o un reintento podía solaparse con una posición nueva. SutranOrderedDispatcher retiene una cola
por clave hasta recibir finalización; la cola de entrega usa destino y placa. El handler usa
dispositivo para conservar el orden al delegar al ejecutor. No hay espera HTTP dentro del monitor
global del despachador. Otros vehículos pueden progresar.

Esto es FIFO de entrada al proceso, no ordenamiento global por tiempo GPS. No puede impedir que
un dispositivo entregue posiciones antiguas después de las nuevas. Tampoco coordina dos instancias
de Traccar. La recuperación ahora utiliza ID ascendente y páginas de 1000 filas, sin límite total
de una sola página. El ID define orden de persistencia, no tiempo GPS.

ProcessingHandler sitúa PositionForwardingHandler antes de DatabaseHandler y SutranForwardingHandler
después. La prueba encadena DatabaseHandler real con ID asignado por almacenamiento simulado y
comprueba ID 321. La cola rechaza ID cero. CatalogPositionForwarder.forward excluye SUTRAN y mantiene
HF/GENERIC_JSON y el delegado forward.url; forwardSutran solo encola SUTRAN. Se conserva la restricción
única SQL positionid/serverid, que impide duplicados incluso ante carreras de inserción.

Los endpoints administrativos existentes invocan reload después de modificar destinos/asignaciones.
Además, cada entrega que empieza lee la configuración actual del destino. Una serie de reintentos
ya iniciada no se cancela al desactivar el destino. La revocación de asignaciones afecta nuevos
encolamientos; no borra el historial o la cola ya persistida.

El handler entrega inmediatamente su callback después de programar trabajo, sin esperar HTTP. Se
reutiliza ExecutorService administrado; Main conserva su shutdown para ejecutor y planificador.
No se ha añadido un nuevo pool ni una modificación del cierre global de Traccar.

## Archivos de esta corrección

| Archivo | Motivo |
| --- | --- |
| src/main/java/org/traccar/forward/sutran/SutranDeliveryResult.java | Clasificación, CRC y mensajes seguros. |
| src/main/java/org/traccar/forward/sutran/SutranResponseCode.java | Identifica 2001 explícitamente. |
| src/main/java/org/traccar/forward/sutran/SutranTransmissionResponse.java | Tolera campos adicionales sin perder code/crc conocidos. |
| src/main/java/org/traccar/forward/sutran/SutranClient.java | Captura errores al leer entidad HTTP. |
| src/main/java/org/traccar/forward/sutran/SutranDeliveryQueue.java | Serialización hasta resultado final, relectura del destino y diagnóstico seguro. |
| src/main/java/org/traccar/forward/sutran/SutranOrderedDispatcher.java | Cola asíncrona FIFO por clave sobre ejecutor existente. |
| src/main/java/org/traccar/handler/SutranForwardingHandler.java | Orden de delegación por dispositivo y logs sin excepción arbitraria. |
| schema/changelog-sutran-crc.xml | Changeset nuevo para CRC sin límite fijo de seis caracteres. |
| schema/changelog-master.xml | Incluye únicamente el nuevo changeset SUTRAN; mantiene los cambios previos ajenos. |
| web/src/monitoring/forwarder/ForwarderPage.jsx | Etiquetas, intentos y diagnóstico controlado. |
| web/src/monitoring/forwarder/sutranDeliveryPresentation.js | Presentación distinguible y comprobable de los acuses. |
| src/test/java/org/traccar/forward/sutran/SutranDeliveryResultTest.java | Matriz de respuestas y protección del mensaje remoto. |
| src/test/java/org/traccar/forward/sutran/SutranClientTest.java | HTTP local, terminalidad y máximos de intentos. |
| src/test/java/org/traccar/forward/sutran/SutranDeliveryQueueTest.java | Persistencia histórica, serialización y recuperación. |
| src/test/java/org/traccar/forward/sutran/SutranOrderedDispatcherTest.java | Exclusión por clave y liberación tras fallo. |
| src/test/java/org/traccar/forward/sutran/SutranMigrationTest.java | Master H2 y conservación SQL de CRC de longitudes diferentes. |
| src/test/java/org/traccar/forward/sutran/SutranTokenCipherTest.java | Corrige prueba inestable: altera un byte cifrado, no bits Base64 que podían ser ignorados. AES-GCM no se modifica. |
| src/test/java/org/traccar/handler/SutranForwardingHandlerTest.java | Callback GPS antes de ejecutar el trabajo SUTRAN. |
| tools/tests/sutranDeliveryPresentation.test.mjs | Etiquetas actual/histórica y anomalías previas. |
| tools/validation/sutran-validation.gradle | Limpieza local que preserva logs abiertos y estilo Java acotado. |
| docs/sutran-security.md | Contrato operativo, CRC, concurrencia y límites. |
| docs/sutran-v2-response-audit.md | Auditoría, validación y procedimiento propuesto. |

No se modifican CatalogPositionForwarder, ProcessingHandler, SutranSendResult ni los changesets
SUTRAN anteriores: la inspección y las pruebas justifican conservarlos. Hay otras modificaciones
previas en el repositorio, principalmente geocercas; no forman parte de esta corrección.

## Consultas de diagnóstico propuestas; NO ejecutadas

Ejecutar posteriormente con un usuario de solo lectura, sin seleccionar payloads, credenciales,
placas ni IMEI. Revisar primero el entorno al que se conecta.

```sql
BEGIN READ ONLY;
SELECT status, responsecode, httpstatus, count(*) AS entregas,
       min(attempts) AS min_intentos, max(attempts) AS max_intentos,
       count(*) FILTER (WHERE crc IS NULL OR btrim(crc) = '') AS sin_crc
FROM tc_forward_deliveries
GROUP BY status, responsecode, httpstatus
ORDER BY responsecode, status, httpstatus;

SELECT responsecode, length(crc) AS longitud_crc, count(*) AS entregas
FROM tc_forward_deliveries
WHERE responsecode IN (2000, 2001)
GROUP BY responsecode, length(crc);

SELECT status, count(*) AS pendientes, min(createdtime) AS mas_antigua
FROM tc_forward_deliveries
WHERE status IN ('PENDING', 'PROCESSING') GROUP BY status;

SELECT data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tc_forward_deliveries' AND column_name = 'crc';

SELECT id, author, dateexecuted, exectype
FROM databasechangelog WHERE id = 'sutran-preserve-crc-20260913';
ROLLBACK;
```

No se entrega UPDATE histórico automático: un 2001 anterior sin CRC no puede reconstruirlo. Una
reclasificación requiere una decisión separada, respaldo y evidencia por entrega; no fabricar CRC.

## Despliegue y rollback propuestos; NO ejecutados

1. Separar esta corrección de otros cambios locales mediante revisión de archivos; no publicar el
   JAR local completo sin revisar el resto del workspace.
2. Respaldar artefactos/configuración y base antes de migrar. Ensayar primero una copia anonimizada.
3. Mantener deshabilitada la salida SUTRAN. Actualizar backend y esquema incluyendo el nuevo archivo;
   verificar Liquibase y las consultas de diagnóstico antes de actualizar frontend.
4. Ensayar respuestas con un servidor local. Solo con autorización posterior habilitar un piloto real.
5. Supervisar distribución de códigos, ausencia de CRC, intentos, pendientes y latencia del pipeline.
6. Ante fallo, deshabilitar SUTRAN y restaurar el binario/frontend anterior. Mantener la columna CRC
   ampliada: es compatible con lectura como String. No reducirla a seis ni borrar databasechangelog.
   El binario anterior vuelve a interpretar mal 2001; mantener la salida apagada hasta corregirlo.
7. Una restauración de base requiere su propio procedimiento y ventana; no sobrescribir entregas
   nuevas indiscriminadamente con un respaldo viejo.

Mensaje de commit propuesto: `fix(sutran): preserve historical acknowledgements and serialize deliveries`.

## Riesgos residuales

- Los PROCESSING ambiguos quedan ahora en FAILED con marcador de conciliación y no se reenvían,
  según la topología de una instancia confirmada. No existe idempotencia remota probada y no se
  garantiza exactamente una entrega; ver sutran-single-instance-recovery.md.
- Los intentos ahora se registran antes de cada HTTP mediante una condición obligatoria de
  persistencia. Contabilizan inicios, no acuses: una caída entre guardar e invocar HTTP puede dejar
  un inicio sin petición efectiva. Los históricos anteriores conservan sus contadores originales.
- FIFO local por destino/placa, sin coordinación multinodo y sin reordenar muestras atrasadas.
- La cola pendiente usa memoria; no se certifica capacidad bajo carga productiva ni drenaje del
  ejecutor durante shutdown. No se modifica globalmente ExecutorService porque lo comparten otros módulos.
- La migración ya fue ensayada en PostgreSQL aislado con datos sintéticos, conservando historial y
  CRC exactos; respaldo/restauración coinciden. Ver sutran-postgres-rehearsal.md. La copia de datos
  reales y la duración del bloqueo de tabla bajo carga productiva no se certifican con ese ensayo.
- No se ha validado contra el endpoint real ni con credenciales reales por restricción expresa.

Resultado de la suite completa después de corregir la prueba Base64: 722 pruebas descubiertas,
691 ejecutadas, 31 omitidas, cero fallos y cero errores. Las 42 pruebas de SUTRAN/catálogo/pipeline
pasaron sin omisiones. Las 31 omitidas incluyen cinco PostgreSQL; no se cuentan como aprobadas.
Los XML están conservados en backups/sutran-validation-preserved/final-test-results (ignorado por Git).
La primera revisión de estilo detectó una línea de 121 caracteres en SutranDeliveryQueue; se dividió
sin cambiar comportamiento antes de la verificación final del JAR y Checkstyle.
La verificación final de Checkstyle de los siete archivos Java modificados y la generación del JAR
terminó BUILD SUCCESSFUL. git diff --check acotado a los archivos SUTRAN tampoco detectó problemas.
Una revisión estática independiente de clasificación, concurrencia, cola, handler, migración y helper
visual no encontró defectos importantes introducidos por el cambio; no sustituye pruebas productivas.

## Cobertura de los criterios solicitados

| Criterios | Evidencia |
| --- | --- |
| 1–7: ambos éxitos, CRC exacto, no reintento, sin error OK, falta CRC | SutranDeliveryResultTest, SutranClientTest con HTTP local, SutranDeliveryQueueTest y SutranMigrationTest SQL. |
| 8–9: códigos funcionales/autorización | Matriz 4001–4004 y 5001–5003 en SutranDeliveryResultTest. |
| 10: timeout y 5xx, máximos | SutranClientTest; el resultado y número de llamadas se comprueban con servidor local. |
| 11: orden | SutranOrderedDispatcherTest y SutranDeliveryQueueTest; misma placa espera, otra continúa. FIFO de entrada, no orden temporal distribuido. |
| 12: PENDING/PROCESSING | SutranDeliveryQueueTest continúa PENDING y pone PROCESSING en conciliación sin enviar. SutranRecoveryStorageTest comprueba las ventanas de caída con SQL real en memoria. |
| 13: doble encolamiento | Encolamiento repetido no envía de nuevo; migración verifica restricción única positionid/serverid. |
| 14–15: después de persistir, ID real | ProcessingHandlerOrderTest y SutranForwardingHandlerTest con DatabaseHandler. |
| 16–17: HF aislado y sin duplicado | CatalogPositionForwarderTest, sin modificación de su implementación. |
| 18: callback GPS | Ejecutar handler con ejecutor retenido completa callback sin invocar catálogo; luego libera trabajo. |
| 19: recarga | CatalogPositionForwarderTest cambia asignaciones y recarga sin reiniciar; inspección de endpoints administrativos. |
| 20: presentación | Dos pruebas Node del formateador importado por ForwarderPage; build y ESLint. No constituye ensayo visual autenticado contra una base real. |
| 21: datos sensibles | Prueba de mensaje remoto no reflejado, diagnóstico de transporte, revisión manual y conteo de literales en líneas añadidas. No prueba exhaustiva de todos los logs de Traccar. |

El cierre posterior de recuperación, persistencia de intentos y ensayo de carga se documenta en
sutran-runtime-closeout.md. Los recuentos anteriores corresponden a sus respectivas etapas,
no sustituyen los resultados más recientes. El soporte sigue limitado a una instancia.

La primera suite completa detectó una prueba inestable anterior del cifrado: sustituir el último
carácter Base64 puede no cambiar los bytes, por los bits finales no significativos. Se corrigió
únicamente la prueba para invertir un bit del último byte y volver a codificarlo.

La primera ejecución literal de `clean test jar` no pudo borrar logs abiertos por los servicios
locales existentes. No se detuvieron. Se preservaron respaldos/evidencias anteriores en
backups/sutran-validation-preserved (ignorado por Git). La segunda limpieza excluye esos logs
mediante tools/validation/sutran-validation.gradle; las clases y recursos se recompilaron desde cero.

No se repitió npm ci: se compararon 808 paquetes instalados con package-lock.json, sin diferencias
de versión en sus entradas coincidentes, y no se modificaron las dependencias en esta tarea.
ESLint de ForwarderPage y su helper pasó, dos pruebas Node pasaron y npm run build pasó con el
aviso de tamaño de chunks existente. El build no se desplegó ni se reinició el backend.

git diff --check señala un espacio final preexistente en web/src/Navigation.jsx:175, ajeno a esta
corrección. Se conservó. La revisión de líneas añadidas de SUTRAN no encontró UUID, IMEI de 15 dígitos
ni asignaciones de credenciales literales. Los fixtures previos usan valores sintéticos; no se
buscaron secretos reales. No se consultó PostgreSQL operativo ni se aplicaron cambios históricos.

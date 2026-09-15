# Recuperación segura SUTRAN para una instancia

El usuario confirmó que producción tiene una sola instancia de Traccar. No se necesita
coordinación multinodo para ese despliegue. No se afirma soporte para varios emisores
contra la misma cola; sería una modificación de arquitectura distinta.

## Política implementada

| Situación | Acción |
| --- | --- |
| PENDING al arrancar o en el barrido periódico | Continúa por páginas en orden de ID, si el destino permite transmitir. |
| PROCESSING al arrancar | Se marca FAILED con SUTRAN_ACKNOWLEDGEMENT_UNKNOWN, sin HTTP. |
| No se puede guardar PROCESSING o el primer intento | No se inicia HTTP. El trabajo conocido como no enviado puede recuperarse tras restablecer la base. |
| Acuse recibido pero no se puede guardar | El estado durable puede seguir PROCESSING; el siguiente arranque lo deja en conciliación, sin reenviar. |
| DELIVERED/REJECTED/FAILED existentes | No se recuperan ni reenvían automáticamente. |

No se añade estado ni columna. FAILED sirve como estado terminal existente y el marcador
controlado diferencia incertidumbre de rechazo. La interfaz muestra “Resultado incierto;
requiere conciliación”, con advertencia y sin atribuir éxito o rechazo a SUTRAN. Los intentos
que muestra son inicios registrados antes de HTTP. No equivalen a recepciones remotas: una caída
entre el registro y la llamada puede dejar un inicio registrado sin petición efectiva.

La recuperación conserva código HTTP, código funcional, CRC, senttime e intentos que ya
existan. No fabrica ninguno. Retira cualquier nextAttempt de la entrega incierta. Un fallo
al guardar la anomalía tampoco inicia HTTP: seguirá siendo PROCESSING hasta otro barrido.

La recuperación se repite cada 30 segundos con el planificador existente. Una reserva por ID
impide reenviar o poner en conciliación trabajo aún activo en esta instancia. Cada candidato
se relee después de reservarlo para no sobrescribir un acuse que llegó durante la consulta.
Si falla el barrido, el siguiente vuelve a consultar. Un fallo conocido previo a HTTP conserva
PENDING; si guardar PENDING también falla, la instancia conserva ese conocimiento en memoria
y reintenta la restauración. Tras perder el proceso, PROCESSING vuelve a ser incierto.
Ese trabajo diferido conserva su turno en la cola por destino y placa: las posiciones más nuevas
esperan al predecesor, mientras las demás placas pueden continuar.

Cada intento HTTP, incluidos los reintentos, exige guardar primero su contador. Si no puede
guardarlo, no se hace esa llamada. Después de algún intento real, un fallo adicional se deja
terminal; no se reinicia automáticamente la serie con un presupuesto nuevo de reintentos.

La entrega DELIVERED se guarda antes de actualizar lastSent de la asignación. El indicador
usa la fecha del acuse persistido y no publica actividad si falla ese guardado. Si posteriormente
falla actualizar lastSent, la entrega sigue siendo la evidencia autoritativa y el indicador puede
quedar atrasado; nunca se revierte una entrega remota por un fallo de ese indicador auxiliar.

El estado PROCESSING se escribe antes de HTTP. Hay una ventana en la que el proceso puede
caer tras ese guardado y antes de transmitir; también quedará en conciliación. Es una decisión
deliberada: evitar un duplicado tiene prioridad sobre volver a intentar una entrega incierta.

## Qué se ensaya

- Pruebas de cola: PENDING continúa, PROCESSING no se reenvía y permanece terminal en otro arranque.
- Fallo del guardado previo: cero llamadas al sender.
- SQL H2 real: se crea otra instancia de cola sobre la misma base, simulando pérdida del callback.
- SQL H2 real: el callback llega pero falla el UPDATE del acuse; el reinicio no reenvía.
- SQL H2 real: falla el UPDATE previo al envío; queda PENDING, sin HTTP, y puede continuar luego.
- Interfaz: el marcador se muestra como advertencia de conciliación, no como rechazo remoto.
- Fallo del primer intento y del retorno a PENDING: se recupera en la misma instancia sin HTTP duplicado.
- Barridos repetidos mientras existe HTTP activo: no duplican ni ponen en conciliación esa entrega.
- PostgreSQL con receptor local: 8 vehículos, 40 segundos, un destino y una hora de cola acumulada.
- JVM auxiliar: caída abrupta después del acuse simulado, antes de persistirlo; recuperación sin reenvío.

Los emisores son dobles de prueba, sin endpoints externos. No se mata ni reinicia el servicio
local del usuario; únicamente termina abruptamente una JVM auxiliar creada por el ensayo.
El ensayo de migración PostgreSQL aprobado está en sutran-postgres-rehearsal.md;
no fue necesario crear otra migración para esta política.

## Operación y conciliación

Consulta propuesta, no ejecutada sobre ninguna base operativa:

```sql
BEGIN READ ONLY;
SELECT id, positionid, serverid, status, attempts, httpstatus, responsecode,
       (crc IS NOT NULL AND length(crc) > 0) AS tiene_crc,
       createdtime, updatedtime
FROM tc_forward_deliveries
WHERE status = 'FAILED' AND errormessage = 'SUTRAN_ACKNOWLEDGEMENT_UNKNOWN'
ORDER BY id;
ROLLBACK;
```

Consultar por canales autorizados la evidencia de recepción de SUTRAN. No cambiar la fila a
PENDING ni pulsar reenvíos sin conciliación. Si no existe forma de verificar la entrega,
mantener la incertidumbre; no inventar un CRC ni una confirmación. Cualquier regularización
de datos se prepara y autoriza aparte. No se implementa reenvío manual en esta corrección.

Antes de actualizar desde la versión anterior, revisar las filas PENDING antiguas: aquella
versión podía iniciar HTTP incluso si fallaba guardar PROCESSING. Su ausencia de acuse no
demuestra que nunca se transmitieron. Esta corrección protege las nuevas operaciones, pero
no reconstruye hechos remotos anteriores. No se modificaron automáticamente esas filas.

## Límites que permanecen

La política cierra el reenvío automático inseguro tras una caída en una sola instancia; no
garantiza “exactamente una entrega” ni entrega de todas las tramas inciertas. Los reintentos
de transporte durante una ejecución conservan el contrato previo: un timeout puede tener
resultado remoto incierto. Resolverlo completamente requiere idempotencia o conciliación
del servicio remoto, capacidades que no se han comprobado ni invocado.

No arrancar una segunda instancia emisora: podría poner en conciliación el trabajo vivo
de la primera. Mantener una sola instancia es una condición de operación, no una exclusión
distribuida implementada. Cambiar esa topología requiere una nueva revisión.

## Verificación final — 13 de septiembre de 2026

La ampliación posterior (14/09), con reintentos previos a HTTP, conservación del turno por placa,
701 pruebas Java ejecutadas sin fallos, ensayo de carga y caída abrupta con PostgreSQL, está en
sutran-runtime-closeout.md. Los resultados siguientes son la evidencia de la etapa anterior.

- Suite Java: 727 pruebas registradas, 695 ejecutadas sin fallos ni errores y 32 omitidas.
  Las dos pruebas de recuperación con almacenamiento H2 se ejecutaron y aprobaron.
- Confirmación final de `test jar checkstyleSutranChange`: BUILD SUCCESSFUL; tareas al día.
- Presentación web: 3 pruebas aprobadas, ninguna omitida.
- Compilación web completada, incluida la generación PWA. Persiste la advertencia de
  paquetes mayores de 500 kB; no impidió compilar.
- Revisión independiente del cambio: sin defectos importantes nuevos identificados bajo
  la condición de una sola instancia. Esto no equivale a una garantía de ausencia de riesgos.
- El ensayo PostgreSQL de migración y restauración está documentado por separado; las
  pruebas de recuperación de esta etapa simulan fallos con H2 y emisores de prueba.

No se hizo commit, push, despliegue, reinicio del backend ni envío real a SUTRAN.

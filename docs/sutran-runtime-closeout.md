# SUTRAN: recuperación, intentos y ensayo integrado

## Alcance autorizado

Una instancia de Traccar, 8 vehículos, una posición por vehículo cada 40 segundos y un destino
SUTRAN: 12 entregas por minuto. No se activa ni se consulta SUTRAN real. No se hace commit,
push, despliegue, reinicio del backend existente ni modificación de la base operativa.

## Correcciones

1. Recuperación periódica cada 30 segundos tras fallos de lectura, con reserva de entregas activas
   y relectura antes de decidir. Los barridos no duplican trabajo ni sobrescriben acuses recientes.
   Un fallo previo a HTTP conserva el turno de la placa para evitar que una posición nueva adelante
   a la pendiente; las demás placas mantienen su independencia.
2. Registro durable de cada intento antes de HTTP. Un fallo del primer registro o de la consulta
   del destino mantiene el trabajo recuperable cuando aún no se inició HTTP. Tras una caída,
   PROCESSING queda en conciliación, sin afirmar que fue rechazado ni volver a enviarlo.
3. lastSent se publica solamente después de guardar DELIVERED y toma la fecha de ese acuse.
   Si falla actualizar el indicador auxiliar, puede quedar atrasado; el acuse durable manda.
4. La interfaz dice “intentos iniciados”. Un inicio persistido no prueba que SUTRAN recibió la trama.

No se amplía el esquema en esta etapa. El changeset CRC aditivo de la etapa anterior permanece.
Los límites de idempotencia remota y datos históricos no se ocultan ni se corrigen inventando datos.

## Ensayo PostgreSQL y receptor simulado

Se reutiliza el clúster desechable con marcador de validación, base geofence_validation y
esquemas sintéticos independientes. Windows bloqueó el puerto anterior 62742; el ensayo actual
utilizó 127.0.0.1:60133. Tras la interrupción del entorno entre sesiones, se verificó que ese
proceso ya no estaba activo y se reinició únicamente el clúster de ensayo en 127.0.0.1:51433.
Ninguna prueba de escritura apunta a 5432.

La prueba usa DatabaseStorage, la cola y el cliente HTTP reales, un pool Hikari de 8 conexiones
y un receptor enlazado exclusivamente a loopback. La configuración del endpoint de producción
no se modifica. No constituye una prueba de todos los receptores GPS ni de la interfaz autenticada.

Resultado de la ejecución con pool:

| Medida | Resultado |
| --- | --- |
| Cola inicial: una hora de 8 vehículos | 720 entregas |
| Recuperación de la cola inicial | 15.121 segundos |
| Rondas posteriores | 3 ráfagas de 8, separadas por 40 segundos reales |
| Tiempo de encolamiento de cada ráfaga | 58, 37 y 42 ms |
| Entregas aceptadas y persistidas | 744 |
| HTTP realizados | 837: incluye 93 reintentos controlados por HTTP 503 |
| Duplicados aceptados / inversiones de orden | 0 / 0 |
| PROCESSING sembrados como inciertos | 8, todos sin reenvío |
| Duración total | 96.840 segundos |

Es evidencia para el volumen indicado en este equipo, no una certificación de latencia de red,
disponibilidad de SUTRAN ni capacidad sostenida del VPS. La primera ejecución sin pool también
pasó, pero abrió conexiones por operación; no se usa como medición representativa de Traccar.

Los resultados se guardan en build/reports/sutran-postgres-runtime.json y los XML de validación.
El ensayo adicional de caída utiliza una JVM hija exclusiva: recibe el acuse del receptor local
y termina con código 73 antes de que la cola lo guarde. La prueba verifica PROCESSING con un
intento durable, reinicia la cola sobre PostgreSQL y exige FAILED de conciliación sin otro HTTP.

## PENDING antiguos

La conexión sin contraseña a 5432/traccar fue rechazada. Se solicitó autorización para usar
internamente la conexión configurada, porque el prompt original prohíbe buscar contraseñas.
Hasta obtenerla y ejecutar el diagnóstico, no se afirma cuántos pendientes antiguos existen.

tools/validation/Audit-SutranPending.ps1 prepara esa consulta con transacción de solo lectura,
timeouts y salida agregada. No selecciona payloads, placas, IMEI, tokens ni contraseñas, ni
actualiza filas. Solo acepta la base local traccar en 5432. Su ejecución con credenciales está
pendiente de la autorización específica; no es un procedimiento de reenvío.

## Verificación

Las regresiones reprodujeron los fallos antes de corregirlos. La revisión independiente detectó
dos casos adicionales de fallo previo a HTTP; se corrigieron. Otra regresión reprodujo el
adelantamiento de una posición nueva durante ese fallo y se corrigió conservando el turno.
La revisión final independiente de esta corrección no encontró nuevos defectos importantes.

Verificación final del 14/09/2026:

- `test jar checkstyleSutranChange` terminó BUILD SUCCESSFUL.
- Suite Java: 735 pruebas registradas, 701 ejecutadas sin fallos ni errores y 34 omitidas.
- Dentro de esa suite: 52 pruebas SUTRAN/catálogo/pipeline ejecutadas sin fallos. Las dos
  PostgreSQL se omiten al no habilitar su entorno en la suite general; ambas se ejecutaron
  y aprobaron por separado en el clúster aislado, no se cuentan dos veces.
- Las siete regresiones H2 de recuperación aprobaron, incluida la conservación del orden.
- Caída abrupta de JVM con PostgreSQL: aprobada, un HTTP antes de la caída y ninguno al recuperar.
- Tres pruebas Node aprobadas; ESLint del componente y helper aprobado; compilación web y PWA
  aprobadas. Persiste la advertencia de paquetes web grandes, sin error de compilación.
- `git diff --check` acotado a SUTRAN aprobado. No se modificaron los cambios ajenos.
- PostgreSQL de ensayo detenido tras verificar directorio, puerto y marcador; se comprobó la
  desaparición de postmaster.pid. No se reinició el backend ni la base local del usuario.

Evidencias: build/reports/sutran-runtime-evidence conserva la suite general y los XML específicos
de carga y caída. build/reports/sutran-runtime-web-build.log conserva la compilación web.

La consulta de PENDING antiguos sigue pendiente de autorización de conexión. Por ello este
informe cierra la implementación y los ensayos aislados, pero no aprueba todavía la activación
productiva ni afirma que la base existente esté libre de pendientes ambiguos.

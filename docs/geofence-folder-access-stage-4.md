# Etapa 4: HTTP real y concurrencia de sesiones

## Validación HTTP

Se utilizan Jetty y Jersey en un puerto temporal de 127.0.0.1, con el filtro
SecurityRequestFilter, LoginService, PermissionsService y GeofenceResource de
producción. Los usuarios y contraseñas son ficticios, guardados en H2 desechable.
No se inicia Main ni se carga debug.xml ni se conecta PostgreSQL operativo.

Las pruebas cubren:

- Autenticación Basic real, credenciales incorrectas y ausencia de autenticación.
- Restricción de menú y aislamiento entre usuarios.
- Parámetro userId ajeno que no cambia la identidad de la nueva consulta.
- Lectura heredada y detalle inaccesible con respuesta 404.
- Listado de Conexiones que conserva exclusivamente asignaciones individuales.
- Revocación de carpeta y usuarios deshabilitados o vencidos.
- Denegación de eliminación por herencia y de escritura para usuarios de solo lectura.

Las revocaciones de la preparación se ejecutan directamente en H2. No son aún
pruebas del guardado múltiple mediante /permissions. Las rutas de escritura se
ejercitan para comprobar su denegación.

Se mantiene el manejador de errores existente: SecurityException se representa
como HTTP 400 y la respuesta incluye una traza. Ese comportamiento es deuda
previa y debe endurecerse antes de exponer la aplicación en producción. Este
ensayo no valida cookies, CSRF, OIDC, tokens firmados ni todos los recursos HTTP.

## Bloqueo reproducido y corrección

Antes de modificar ConnectionManager, la prueba
slowReloadDoesNotBlockOtherSubscribers produjo TimeoutException: una recarga SQL
detenida impidió completar una actualización de otro usuario dentro de un segundo.
La consulta se controla con latches; no depende de que PostgreSQL sea lento.

Se separaron tres pasos:

1. Bajo el bloqueo de sesiones, retirar las autorizaciones afectadas y asignar
   una versión nueva de recarga.
2. Consultar usuarios, vehículos y geocercas fuera del bloqueo.
3. Publicar el resultado bajo el bloqueo solamente si su versión sigue vigente.

Una recarga anterior no puede restituir permisos revocados ni publicar datos en
una sesión nueva que use el mismo usuario después de desconectarse.
Las nuevas conexiones también consultan fuera del bloqueo global.

Mientras hay una recarga en curso, la actualización periódica no inicia otra
consulta para ese usuario. Una invalidación explícita sí puede iniciar una
versión posterior. Si una recarga falla, sus permisos permanecen retirados y
se programa el siguiente intento lógico para dentro de 30 segundos.

## Medición sintética

GeofenceReadAccessLoadTest prepara 20 usuarios, 100 carpetas y 10000 geocercas
en H2. Tras tres consultas de calentamiento, ejecuta una recarga secuencial de
identificadores por usuario y comprueba 100 geocercas autorizadas para cada uno.
Publica p50, p95, máximo y tiempo total en build/reports/geofence-load.json.
No impone un umbral de rendimiento dependiente de la máquina.

Esta medición no representa carga HTTP concurrente, latencia de red, PostgreSQL
ni geometrías reales. No permite deducir una capacidad máxima de usuarios.

## Límites que se conservan

- El hilo que inicia una recarga espera su SQL; la optimización libera a otros
  hilos y usuarios, no convierte la consulta en asíncrona.
- Durante la recarga se omiten entregas a los usuarios afectados. No hay un
  mecanismo nuevo de repetición de esos mensajes. El almacenamiento de GPS
  no se modifica.
- Los callbacks y algunas operaciones existentes siguen bajo el bloqueo de
  sesiones. No se afirma haber eliminado toda contención de ConnectionManager.
- Las recargas de varios usuarios son secuenciales. Los permisos por carpeta
  siguen recorriendo geocercas porque folderId está en atributos JSON.
- No hay garantía transaccional entre lectura de permisos y una escritura
  concurrente. Los mensajes ya enviados no pueden retirarse.
- Una consulta SQL que no termina mantiene la sesión afectada sin datos; los
  timeouts y límites del pool deben validarse en el entorno de despliegue.
- Pendientes PostgreSQL aislado, recuperación desde respaldo, carga concurrente
  real y fallos entre nodos. No se desplegó ni se modificó la interfaz.

## Orden recomendado siguiente

Endurecer las respuestas HTTP de error con pruebas de compatibilidad; ensayar
PostgreSQL en una instancia separada; medir consultas y normalizar folderId si
los resultados lo requieren. Después abordar el guardado transaccional de
asignaciones y el selector jerárquico.

## Resultado de verificación

La ejecución final aprobó 81 pruebas, sin fallos ni errores. Compilación Java
correcta con JDK 17. Checkstyle aprobó los 10 archivos Java de producción de
la funcionalidad usando las reglas existentes.

La prueba de concurrencia entregó la actualización del usuario no afectado en
3 ms mientras la recarga permanecía detenida; la ejecución anterior registró
4 ms. Antes de la corrección, la misma comprobación vencía el límite de 1 segundo.
Es evidencia de eliminación de ese bloqueo concreto, no una garantía de latencia.

La última medición H2 registró:

| Medida | Resultado |
| --- | ---: |
| Usuarios / geocercas | 20 / 10000 |
| Total de recargas secuenciales | 1058,05 ms |
| Mediana por recarga | 36,71 ms |
| Percentil 95 | 98,74 ms |
| Máximo | 113,87 ms |

Una ejecución previa tardó 774,73 ms en total. La variación confirma que estas
cifras dependen de calentamiento, carga de la máquina y ejecución del conjunto
de pruebas. No se usan como umbral de aceptación para producción.

Comando de regresión desde la raíz, con JAVA_HOME apuntando a JDK 17:

```powershell
.\gradlew.bat test --tests 'org.traccar.alert.*' --tests 'org.traccar.api.security.*' --tests org.traccar.api.resource.GeofenceReadAccessResourceTest --tests org.traccar.api.resource.GeofenceHttpAccessTest --tests org.traccar.api.resource.AlertEventReadAuthorizationTest --tests org.traccar.session.ConnectionManagerPermissionsTest --tests org.traccar.session.cache.GeofenceInvalidationTest --tests org.traccar.session.cache.SessionPermissionWiringTest --tests org.traccar.storage.GeofenceFolderMigrationTest --tests org.traccar.handler.events.GeofenceEventHandlerTest --tests org.traccar.forward.sutran.SutranMigrationTest --console=plain
```

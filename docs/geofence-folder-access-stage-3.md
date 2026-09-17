# Etapa 3: actualización de permisos en sesiones y alertas

La etapa 4 sustituye la recarga SQL bajo el bloqueo global por recargas con
versiones fuera del bloqueo. Consultar geofence-folder-access-stage-4.md para
el comportamiento y las validaciones posteriores.

## Comportamiento

Las sesiones de usuarios conectados recalculan sus permisos cuando cambian
asignaciones de vehículos, grupos de vehículos, geocercas o carpetas. Los cambios
de jerarquía y la creación, movimiento o eliminación de geocercas también
actualizan las sesiones. Los accesos a vehículos siguen usando las asociaciones
originales de Traccar; las carpetas de geocercas no conceden acceso a vehículos.

Se corrigió la sobrescritura de suscriptores al asignar un vehículo compartido.
Retirar un usuario conserva los otros suscriptores y retirar una carpeta conserva
los accesos individuales todavía vigentes.

El backend filtra las alertas personalizadas en tiempo real por acceso al vehículo
y a la geocerca. El historial y Telegram comprueban también la geocerca mediante
la misma regla de lectura directa o heredada. El estado de una alerta mantiene
la política previa de gestión y exige además acceso de lectura actual y ausencia
de la restricción de solo lectura. La herencia por sí sola no concede gestión.

Las notificaciones Telegram se verifican en el momento de ejecutar la tarea de
envío, no solamente cuando se encolan. Las pruebas usan notificadores simulados;
no se enviaron mensajes reales.

## Actualización y fallos

CacheManager avisa explícitamente a las sesiones del proceso local antes de
publicar la invalidación. Es necesario porque NullBroadcastService no devuelve
los mensajes al proceso emisor. Los receptores remotos utilizan los listeners
existentes, sin reenviar mensajes ni crear un bucle.

La nueva dependencia usa Provider para evitar un ciclo de construcción entre
CacheManager y ConnectionManager.

Las recargas retiran los permisos anteriores antes de consultar y publican el
conjunto nuevo después de completar las consultas. Si falla el almacenamiento,
se deja de entregar posiciones y alertas personalizadas a esa sesión. Se
reintenta al vencer el intervalo de 30 segundos, durante una actualización
posterior o un keepalive; una nueva invalidación también permite reintentar.
Un fallo de registro inicial no deja una sesión parcialmente registrada.

Se renuevan permisos cada 30 segundos durante la actividad de las sesiones como
respaldo ante mensajes de invalidación perdidos. Si se conoce una fecha de
vencimiento anterior, se usa esa fecha. No existe un temporizador por usuario.

La caché de alcance de alertas se invalida al modificar geocercas o carpetas.
Invalidar y publicar una recarga usan el mismo monitor para impedir que una
recarga en curso reponga una caché invalidada. Al cambiar carpetas se reinicia
la referencia de entrada/salida de las alertas basadas en carpetas; las alertas
ajenas a ese alcance conservan su estado.

La jerarquía y el análisis de folderId se comparten desde
GeofenceFolderHierarchy, en helper/model. Las ramas con ciclos o padres
inexistentes y los identificadores malformados no amplían el alcance.

## Límites operativos

- No se aplicaron migraciones ni cambios al PostgreSQL local.
- No se desplegó la aplicación ni se modificó la interfaz en esta etapa.
- La invalidación actúa después de la escritura. Una petición, evento o mensaje
  que ya esté en curso puede terminar con su autorización anterior; no se
  garantiza revocación transaccional distribuida.
- Redis/multicast existentes no garantizan entrega duradera. El intervalo de
  refresco reduce la persistencia de datos de permisos obsoletos; no reemplaza
  una cola duradera ni una prueba de fallos entre nodos.
- La recarga de sesiones consulta identificadores y atributos, sin geometrías.
  Para usuarios con solo permisos individuales filtra en SQL. Los usuarios con
  carpetas todavía requieren recorrer geocercas porque folderId reside en JSON.
- La recarga utiliza el monitor existente de ConnectionManager. Bajo alta
  concurrencia o consultas lentas puede retrasar el despacho de actualizaciones.
  Debe medirse antes de producción; el siguiente trabajo de rendimiento debe
  separar la carga SQL del monitor usando versiones de permisos y normalizar
  folderId para indexar consultas.
- Las consultas del historial comprueban cada evento y pueden ejecutar varias
  consultas SQL. Pendiente medir y agrupar comprobaciones por petición.
- El navegador puede conservar datos previamente recibidos. La actualización
  visual y el selector jerárquico aún requieren su propia integración.
- Las notificaciones nativas de Traccar y sus permisos de gestión no se
  convierten a la nueva herencia en esta etapa.

## Próximo paso recomendado

Antes de habilitar el selector de asignación por carpetas, validar HTTP real,
una copia restaurada en PostgreSQL y carga con usuarios no administradores.
Después implementar guardado transaccional y actualización del árbol visual.
Mantener el despliegue separado de las pruebas y ensayar restauración.

## Verificación realizada

Compilación con JDK 17 correcta. Las 73 pruebas seleccionadas terminaron sin
fallos ni errores. Incluyen consultas SQL y migraciones en H2 desechable,
regresiones del procesador de alertas, destinatarios, notificaciones, sesiones,
comprobación de lectura frente a gestión y construcción real de dependencias
mediante Guice.

Checkstyle pasó en los 10 archivos Java de producción revisados para esta
funcionalidad, con las reglas existentes. Esto no elimina las incidencias
globales del repositorio documentadas en la etapa 2.

Comando de regresión reproducible, desde la raíz y con JAVA_HOME configurado:

```powershell
.\gradlew.bat test --tests 'org.traccar.alert.*' --tests 'org.traccar.api.security.*' --tests org.traccar.api.resource.GeofenceReadAccessResourceTest --tests org.traccar.api.resource.AlertEventReadAuthorizationTest --tests org.traccar.session.ConnectionManagerPermissionsTest --tests org.traccar.session.cache.GeofenceInvalidationTest --tests org.traccar.session.cache.SessionPermissionWiringTest --tests org.traccar.storage.GeofenceFolderMigrationTest --tests org.traccar.handler.events.GeofenceEventHandlerTest --tests org.traccar.forward.sutran.SutranMigrationTest --console=plain
```

Las llamadas a métodos de recursos no son pruebas HTTP completas. Las pruebas
de invalidación remota invocan los receptores en memoria; no levantan Redis ni
multicast ni prueban particiones reales de red.

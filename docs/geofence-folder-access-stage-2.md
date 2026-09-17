# Etapa 2: consulta de geocercas por carpetas

## Alcance

Se añade un servicio de lectura independiente de las autorizaciones de escritura.
Una asignación de carpeta permite consultar las geocercas de esa carpeta y sus
descendientes válidos. El acceso individual se conserva y se combina sin duplicados.
Las carpetas de geocercas no son los grupos de vehículos de Traccar.

La interfaz actual todavía no consume esta consulta. No se cambian las operaciones
de asignación, edición, eliminación, delegación, evaluación GPS ni alertas.
No se ejecutaron migraciones ni escrituras sobre PostgreSQL local.

## Contrato de la API

- `GET /api/geofences/read-access`: árbol estructural y geocercas consultables
  por el usuario autenticado. No admite seleccionar otro usuario.
- `GET /api/geofences/read-access/{id}`: detalle autorizado; devuelve 404 si
  la geocerca no forma parte del resultado.
- Las respuestas correctas incluyen `Cache-Control: no-store`.
- Se conservan las rutas actuales de asignaciones directas para Conexiones.

El resultado tiene `administrator`, `folders` y `geofences`.
Cada geocerca incluye su objeto, `folderId` normalizado, `direct` e `inherited`.
Ambas procedencias pueden ser verdaderas. Los administradores pueden consultar
todos los objetos aunque esas dos procedencias sean falsas.

Cada carpeta incluye solamente id, nombre, padre y procedencia. `contextOnly`
identifica los padres necesarios para representar el árbol: su presencia no
autoriza consultar otras geocercas ni editar esa carpeta. Esto implica revelar
los nombres de los antecesores de una geocerca asignada individualmente.
La interfaz debe usar el `folderId` normalizado, no el atributo original, para
construir el árbol.

## Seguridad y consistencia

- Se rechazan usuarios inexistentes, deshabilitados, vencidos o sin identidad
  persistida positiva. No se amplía acceso para cuentas internas de servicio.
- Las ramas con ciclos o padres inexistentes no conceden herencia.
  Los accesos individuales se conservan y se presentan en la raíz si corresponde.
- No se modifica `PermissionsService.checkPermission`; los permisos heredados
  no habilitan PUT, DELETE ni delegación mediante las rutas actuales.
- No hay caché compartida: una consulta posterior vuelve a resolver permisos.
  Las consultas SQL son separadas, sin una instantánea transaccional común;
  una revocación concurrente puede coincidir con una lectura ya iniciada.
- Los errores de almacenamiento se propagan sin devolver resultados parciales.

## Limitaciones antes de producción

La resolución recorre todas las geocercas en el servidor mediante un stream.
No devuelve geometrías ajenas al usuario, pero el coste crece con el total de
datos. El detalle también utiliza esa resolución. Antes de habilitarlo a escala
se debe medir carga y valorar normalizar folderId en una columna indexada para
filtrar mediante SQL.

Pendientes: ensayar migración en PostgreSQL desechable y copia restaurada;
probar HTTP real con autenticación y restricciones por menú; definir y probar la
consistencia requerida para revocaciones concurrentes; integrar invalidación
de alertas/sesiones; y construir el selector jerárquico con guardado transaccional.
El servicio por sí solo no actualiza pantallas ni conexiones WebSocket.

## Verificación

Las pruebas del servicio utilizan DatabaseStorage y H2 desechable con SQL real.
Cubren aislamiento, descendencia, asignaciones superpuestas, retirada, movimiento,
jerarquías inválidas, atributos inválidos y estados de usuario.
Las pruebas del recurso invocan sus métodos directamente; no sustituyen una prueba
HTTP de extremo a extremo.

Resultado: 33 pruebas aprobadas, sin fallos ni errores (11 del servicio nuevo,
3 del recurso, 4 de permisos base, 7 de migración de carpetas y 8 regresiones).
Compilación Java correcta con JDK 17.

La revisión global `checkstyleMain` falló: el informe inicial registró 1175
incidencias, principalmente finales de línea CRLF del checkout. Incluía dos
incidencias de los archivos de esta etapa (finales de línea y longitud de línea),
que se corrigieron. Las incidencias del resto del proyecto se mantienen como
pendiente independiente; no se reformateó masivamente el repositorio.
La revisión específica de los tres archivos Java de producción de esta etapa
pasó con las mismas reglas de Checkstyle del proyecto, sin incidencias.

Comando reproducible desde la raíz del proyecto, con JAVA_HOME apuntando a JDK 17:

```powershell
.\gradlew.bat test --tests org.traccar.api.resource.GeofenceReadAccessResourceTest --tests org.traccar.api.security.GeofenceReadAccessServiceTest --tests org.traccar.storage.GeofenceFolderMigrationTest --tests org.traccar.api.security.GeofencePermissionBaselineTest --tests org.traccar.forward.sutran.SutranMigrationTest --tests org.traccar.handler.events.GeofenceEventHandlerTest --tests org.traccar.alert.AlertGeofenceStateManagerTest --console=plain
```

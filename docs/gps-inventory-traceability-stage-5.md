# Etapa 5 - Asignacion y reasignacion trazable

## Alcance implementado

- Asignacion de un identificador GPS disponible a un dispositivo.
- Retiro del identificador con estado destino controlado.
- Reasignacion atomica entre dispositivos.
- Motivo obligatorio y observaciones opcionales en cada operacion.
- Registro historico con nombre e identificador unico del dispositivo como instantanea.
- Actualizacion sincronizada del dispositivo y estado actual del inventario.
- Acciones disponibles desde el historial de Inventario GPS.

## Controles de integridad

- Una sola asignacion activa por identificador GPS.
- Una sola asignacion activa por dispositivo.
- Bloqueo pesimista del inventario y los dispositivos durante la operacion.
- Transaccion unica para historial, evento y estado actual; cualquier error revierte todo.
- No se permite asignar ni reasignar identificadores dados de baja.
- No se permite cambiar la asignacion durante una revision tecnica activa.
- El retiro conserva las instantaneas historicas aunque el dispositivo haya sido eliminado.
- Estas operaciones no cambian el `uniqueId` operativo, la recepcion de posiciones ni la retransmision.

## API agregada

- `POST /api/gps-inventory/{id}/assignments`
- `POST /api/gps-inventory/{id}/assignments/unassign`
- `POST /api/gps-inventory/{id}/assignments/reassign`

Todas requieren sesion, permiso de lectura sobre el registro y permiso de edicion de Inventario GPS.

## Validacion realizada

- Compilacion limpia del backend: correcta.
- Build productivo del frontend: correcto.
- ESLint focalizado en Inventario GPS y navegacion: correcto.
- Esquema PostgreSQL: tres tablas de trazabilidad y tres indices unicos parciales presentes.
- Estado del servicio existente: `/api/server` responde HTTP 200.
- La suite completa no pudo iniciarse en el directorio alterno de compilacion porque el classpath de pruebas
  depende del directorio `build` original; ademas permanece la incidencia preexistente de codificacion
  Windows-1252 en `WialonProtocolDecoderTest`. La compilacion principal no presenta errores.

## Validacion manual habilitada

A partir de esta etapa puede validarse manualmente el flujo funcional:

1. Abrir Inventario GPS y entrar al historial de un identificador disponible.
2. Asignarlo a un dispositivo e indicar un motivo.
3. Confirmar el nuevo estado `asignado` y la fila activa en Asignaciones.
4. Reasignarlo a otro dispositivo y confirmar el cierre de la fila anterior.
5. Retirarlo, seleccionar el estado destino y confirmar que ninguna asignacion quede activa.
6. Revisar que los eventos conserven fecha, usuario, dispositivo y motivo.

La publicacion de un nuevo JAR debe hacerse antes de probar estas rutas contra un proceso backend que siga
ejecutando un artefacto anterior.

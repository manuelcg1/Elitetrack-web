# Trazabilidad de Inventario GPS — Etapa 4

Fecha de validación: 2026-08-13

## Alcance implementado

Se incorporó el flujo manual de revisión técnica desde la página de historial:

- iniciar una revisión con observaciones;
- completar la revisión con resultado, diagnóstico, acciones realizadas, próxima fecha
  y observaciones;
- registrar automáticamente los eventos `INSPECTION_STARTED` y
  `INSPECTION_COMPLETED`;
- actualizar el estado administrativo del GPS;
- ocultar las operaciones a usuarios de solo lectura.

## Endpoints

| Método | Ruta | Operación |
| --- | --- | --- |
| POST | `/api/gps-inventory/{id}/inspections` | Iniciar revisión |
| POST | `/api/gps-inventory/{id}/inspections/{inspectionId}/complete` | Completar revisión |

Ambos requieren permiso de lectura sobre el activo y permiso de edición sobre
Inventario GPS.

## Reglas de negocio

- Solo puede existir una revisión abierta por GPS.
- La restricción se aplica también en PostgreSQL para cubrir operaciones concurrentes.
- Un GPS dado de baja no puede entrar en revisión.
- Solo puede completarse una revisión que pertenezca al GPS y continúe abierta.
- Resultados permitidos: operativo, reparado, requiere reparación, observación y no
  reparable.
- `operational` y `repaired` devuelven el activo a `en_almacen`.
- `requires_repair` y `observation` conservan `en_revision`.
- `unrepairable` cambia el estado a `danado`; no ejecuta la baja automáticamente.

## Atomicidad

Cada inicio o finalización utiliza una transacción de base de datos y bloqueo de fila
del activo. Revisión, evento y estado se confirman juntos o se revierten juntos. Las
operaciones no modifican el dispositivo Traccar ni su `uniqueId`.

## Validación

- Compilación backend correcta.
- ESLint específico del historial y diálogo: correcto.
- Compilación frontend productiva correcta, 2,098 módulos.
- Migración aplicada sobre una copia restaurada: correcta, seis cambios.
- Restricción de revisión activa simultánea: verificada.
- Flujo inicio, evento, finalización y evento: verificado dentro de transacción.
- Rollback de la prueba funcional: cero revisiones y cero eventos residuales.
- Rollback Liquibase de seis cambios: correcto.
- Base temporal eliminada.
- Suite backend: conserva los mismos 4 fallos conocidos de Telegram. La ejecución
  también reportó mensajes de codificación Windows-1252 en pruebas Wialon, sin generar
  un fallo adicional en el conteo final de 604 pruebas.

## Validación manual

Después de desplegar y reiniciar:

1. Abrir el historial de un GPS que no esté dado de baja.
2. Pulsar `Iniciar revisión técnica`, agregar observación y confirmar.
3. Verificar estado `En revisión`, una revisión abierta y evento de inicio.
4. Confirmar que ya no se ofrece iniciar otra; se muestra `Completar revisión activa`.
5. Completar con cada resultado relevante y verificar estado, diagnóstico y evento.
6. Recargar la página y confirmar que la información permanece.
7. Acceder con usuario de solo lectura y confirmar que no aparecen botones de escritura.
8. Verificar en paralelo que el dispositivo continúa transmitiendo y que sus posiciones
   no cambiaron.


# Trazabilidad de Inventario GPS — Etapa 2

Fecha de validación: 2026-08-13

## Alcance implementado

La etapa expone únicamente consultas sobre las estructuras creadas en la Etapa 1.
No incorpora endpoints para crear, modificar o eliminar asignaciones, inspecciones o
eventos.

Nuevos modelos de almacenamiento:

- `GpsInventoryAssignment`
- `GpsInventoryInspection`
- `GpsInventoryEvent`

El modelo `GpsInventory` ahora expone las fechas y responsables del ciclo de vida como
propiedades JSON de solo lectura.

## Endpoints

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/api/gps-inventory/{id}/assignments` | Historial de asignaciones |
| GET | `/api/gps-inventory/{id}/inspections` | Revisiones técnicas |
| GET | `/api/gps-inventory/{id}/events` | Eventos del ciclo de vida |
| GET | `/api/gps-inventory/{id}/history` | Vista consolidada del activo y sus historiales |

Todos aceptan `limit` y `offset`. El límite predeterminado es 100 y el máximo 1,000.
Los resultados se ordenan desde el más reciente. Antes de consultar, el backend exige
permiso sobre el activo GPS; un activo inexistente produce HTTP 404.

## Compatibilidad

- Las rutas CRUD existentes no cambian.
- Una edición existente preserva las fechas, responsables y motivo de baja almacenados;
  un cliente no puede sobrescribirlos mediante JSON.
- No se modifica `tc_devices.uniqueid`.
- No se invalida caché ni sesión.
- No se modifica recepción, almacenamiento o reenvío de posiciones.
- Las nuevas consultas están protegidas por el mismo menú de Monitoreo que el recurso
  actual.

## Validación

- Compilación Java: correcta.
- Suite backend: 604 pruebas, 4 fallos y 26 omitidas; son exactamente los cuatro fallos
  conocidos desde la Etapa 0.
- No aparecieron regresiones nuevas.
- `git diff --check`: correcto.
- Checkstyle global continúa bloqueado por 1,170 incidencias preexistentes en 1,043
  archivos, principalmente finales CRLF frente a LF. El reporte también detecta el
  estilo compacto preexistente del modelo `GpsInventory`; no se hizo una normalización
  masiva porque quedaría fuera del alcance y mezclaría archivos no relacionados.

## Estado de activación

Los endpoints requieren que la migración de la Etapa 1 esté aplicada. No se reinició el
servicio local ni se migró su base activa durante esta validación. La comprobación HTTP
con sesión corresponde a la etapa de despliegue controlado, después de construir el
artefacto completo.


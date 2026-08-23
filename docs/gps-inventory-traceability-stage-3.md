# Trazabilidad de Inventario GPS — Etapa 3

Fecha de validación: 2026-08-13

## Alcance implementado

Se habilitó la ruta visual:

`/monitoring/gps-inventory/{id}/history`

El botón de historial que ya existía en Inventario GPS ahora abre una página real con:

- cabecera del activo, IMEI, marca, modelo, serie y estado;
- fecha de registro, asignación actual y fecha de baja;
- historial de asignaciones y retiros;
- revisiones técnicas;
- línea de tiempo de eventos;
- estados vacíos diferenciados cuando aún no existen movimientos;
- estado de carga y mensaje de error controlado;
- navegación de regreso al inventario.

La pantalla es adaptable a escritorio y móvil y consulta únicamente
`GET /api/gps-inventory/{id}/history?limit=500`.

## Validación automatizada

- ESLint de la nueva página y `Navigation.jsx`: correcto, cero errores.
- Compilación productiva: correcta, 2,097 módulos transformados.
- El historial se genera como un módulo lazy independiente.
- No se incorporaron llamadas POST, PUT o DELETE desde la página.
- La conexión con el navegador integrado no estuvo disponible en el entorno de
  ejecución; por ello la comprobación visual queda incluida en la guía manual.

## Primera validación manual autorizada

La Etapa 3 es el primer punto recomendado para validación manual. Deben desplegarse
juntas las Etapas 1, 2 y 3 y reiniciarse el servicio para que Liquibase cree las tablas
y el backend publique los endpoints.

Procedimiento:

1. Iniciar sesión con un usuario que tenga acceso a Monitoreo e Inventario GPS.
2. Abrir `Monitoreo > Inventario GPS`.
3. Confirmar que listado, filtros, creación y edición continúan funcionando.
4. Pulsar el icono de historial de un GPS.
5. Confirmar que aparece el IMEI correcto y el estado actual.
6. En registros anteriores a la mejora, verificar `Sin fecha registrada`.
7. Confirmar los estados vacíos de asignaciones, revisiones y eventos.
8. Pulsar `Volver al inventario` y confirmar que regresa al listado.
9. Intentar abrir un ID inexistente y confirmar un mensaje controlado, sin pantalla en
   blanco.
10. Probar con un usuario sin permiso sobre el activo y confirmar que no puede leer su
    historial.

En esta etapa todavía no aparecerán movimientos reales porque no existen operaciones
de escritura. La validación funcional de revisiones comienza en la Etapa 4; la de
asignar, retirar y reasignar comienza en la Etapa 5.

## Elementos sin impacto

- `tc_devices.uniqueid`
- recepción y almacenamiento de posiciones;
- caché y sesiones;
- reportes, alertas, geocercas y reenvíos;
- CRUD existente del Inventario GPS.


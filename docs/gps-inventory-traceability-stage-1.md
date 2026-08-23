# Trazabilidad de Inventario GPS — Etapa 1

Fecha de validación: 2026-08-13

## Alcance implementado

La migración `schema/changelog-gps-inventory-traceability.xml` es exclusivamente
aditiva. No cambia el CRUD, las APIs, `tc_devices.uniqueid`, las sesiones ni la
recepción de posiciones.

Agrega a `tc_gps_inventory` siete campos opcionales:

- `registeredat`, `registeredby`
- `updatedat`, `updatedby`
- `retiredat`, `retiredby`
- `retirementreason`

No se asignan fechas a registros existentes para evitar fabricar información
histórica.

Agrega las tablas:

- `tc_gps_inventory_assignments`: asignaciones y retiros con snapshots del dispositivo.
- `tc_gps_inventory_inspections`: revisiones técnicas.
- `tc_gps_inventory_events`: línea de tiempo del ciclo de vida.

## Protecciones

- Un GPS solo puede tener una asignación abierta.
- Un dispositivo solo puede tener una asignación GPS abierta.
- Las reglas anteriores se implementan con índices únicos parciales de PostgreSQL.
- Al eliminar un dispositivo, su referencia se vuelve nula, pero permanecen los
  snapshots de nombre e identificador.
- Las tablas históricas restringen la eliminación del activo padre.
- Al eliminar un usuario, su referencia se vuelve nula sin borrar el evento histórico.
- Los campos de fecha e historial están indexados para consultas cronológicas.
- Los seis cambios incluyen rollback explícito.

## Validación sobre copia restaurada

Se creó `traccar_stage1_validation` desde el respaldo de la Etapa 0.

Resultados:

1. Aplicación Liquibase: correcta, seis cambios ejecutados y cero filas de negocio
   modificadas.
2. Datos conservados: 17 dispositivos y 1 activo de inventario.
3. Estructura: tres tablas y siete columnas nuevas verificadas.
4. Restricción de GPS activo único: verificada.
5. Clave foránea contra inventario: verificada.
6. Rollback de los seis cambios: correcto; tablas y columnas nuevas quedaron en cero.
7. Reaplicación después del rollback: correcta.
8. Segunda aplicación: base actualizada, cero cambios pendientes.
9. La base temporal fue eliminada al finalizar.

## Regresión

- Backend: 604 pruebas, 4 fallos y 26 omitidas. Son exactamente los cuatro fallos
  conocidos de la Etapa 0; no aparecieron fallos nuevos.
- Frontend: compilación productiva correcta, 2,093 módulos transformados.
- La base local activa no recibió la migración durante esta validación.

## Activación

El archivo quedó incluido al final de `schema/changelog-master.xml`. Al desplegar una
versión que contenga esta etapa, Liquibase aplicará las estructuras antes de iniciar el
servicio. Hasta implementar la Etapa 2, los nuevos campos y tablas permanecerán vacíos
y el comportamiento funcional será el mismo.

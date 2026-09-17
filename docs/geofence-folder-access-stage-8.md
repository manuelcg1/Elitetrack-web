# Etapa 8: lectura heredada en el panel principal

El panel de geocercas del mapa principal consulta ahora
GET /api/geofences/read-access para el usuario autenticado. Ya no compone la
vista a partir de los dos catálogos de asignaciones directas.

Se conservan las carpetas de contexto devueltas por el servidor, la jerarquía
expandible, la selección de visibilidad y el enfoque en el mapa. Las geocercas
heredadas muestran su etiqueta. La búsqueda abre las ramas con coincidencias
sin eliminar sus ancestros. El botón Volver a cargar actualiza la consulta.

La proyección utiliza el folderId resuelto por el servidor, no el atributo
original sin validar. Un cambio de usuario o de carga invalida las respuestas
anteriores. Al iniciar una recarga se vacía el catálogo anterior; un fallo
descarta la visibilidad y comunica el error. No se implementó actualización
automática de permisos en el navegador: un panel abierto se actualiza al recargar
o volver a abrirse. La validación de permisos de cada petición sigue en el servidor.

No se añadieron acciones de escritura ni se modificaron endpoints de edición.
Las casillas del panel solo muestran u ocultan elementos en el mapa. Las banderas
readInherited/readDirect son metadatos de presentación, nunca autorización.
La pantalla de administración de geocercas mantiene su flujo de permisos directos.

## Verificación y límites

Nueve pruebas Node aprobadas, incluidas proyección de lectura, rechazo de respuesta
incompleta, herencia y guardado transaccional. ESLint de los archivos modificados
y compilación Vite/PWA comprobados. Log: build/reports/geofence-stage8-web-build.log.

Las pruebas HTTP del endpoint se ejecutan con usuarios y base sintéticos. El ensayo
integrado del mapa con backend aislado y copia anonimizada sigue pendiente, según
lo acordado. No se utiliza el respaldo antiguo ni se toca la base operativa.
No se realizó despliegue ni push. Las mediciones con catálogos grandes y la
actualización automática del panel requieren una etapa posterior.

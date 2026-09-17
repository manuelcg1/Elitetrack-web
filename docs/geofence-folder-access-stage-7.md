# Etapa 7: editor jerárquico de asignaciones

En Ajustes → Usuarios → Conexiones, el selector individual de Geo-Zonas se
sustituye por «Asignar grupos y geocercas». Abre un diálogo con carpetas padres,
hijas y geocercas indentadas, búsqueda y guardado explícito.

Las casillas representan asignaciones directas; la etiqueta Heredado representa
la lectura derivada de las carpetas seleccionadas. Pueden coexistir ambos estados.
Desmarcar un padre no elimina una asignación individual. Los cambios de carpetas
y geocercas se envían juntos a /api/permissions/batch con identificadores numéricos.
Cancelar descarta el borrador. Solo lectura bloquea la edición; el backend sigue
siendo responsable de autorizar cada cambio.

El editor usa los endpoints existentes de catálogos y relaciones directas, sin
ampliar permisos ni consultar /read-access como si perteneciera a otro usuario.
Conserva asociaciones no presentes en el catálogo del operador. Para operadores
no administradores muestra un aviso de vista parcial: la herencia mostrada es una
previsualización del catálogo visible, no una certificación de todo el acceso
efectivo del usuario. Las ramas cíclicas o sin padres visibles se marcan como
incompletas, no conceden herencia en la previsualización y no permiten nuevas
asignaciones a esas carpetas. Se permite retirar una asignación directa existente.

## Validación

- Siete pruebas Node aprobadas: herencia, conservación de asignaciones explícitas,
  ramas inválidas, lotes mixtos y regresión del helper de guardado anterior.
- ESLint de los tres archivos de producción del cambio aprobado.
- Ensayo en navegador con componentes reales y transporte sintético: selección
  del padre, etiquetas heredadas, alta de carpeta y baja individual en una petición,
  respuesta perdida tras commit con recarga sin otra escritura, solo lectura,
  cancelación sin petición y retirada del padre conservando asignación explícita.
- Compilación Vite/PWA registrada en build/reports/geofence-stage7-web-build.log.

Reproducir el entorno visual con node tools/validation/permission-ui.mjs.
Detenerlo antes de compilar: Vite limpia web/build, que contiene el fixture temporal.
Se corrigió el aviso de React de alignItems moviendo la alineación a sx.
Las comprobaciones de navegador no constituyen un E2E contra una instalación
completa. Los tests HTTP reales de roles y transacciones están documentados en
etapas anteriores; esta etapa no cambia Java ni migraciones.

## Alcance pendiente antes de producción

El editor presenta una lista jerárquica expandida; no incluye colapso de ramas ni
virtualización. Debe medirse con el catálogo objetivo antes del despliegue.
La integración completa con cuentas de prueba y backend aislado, así como el
ensayo de migración de una copia anonimizada actual, siguen pendientes.
El respaldo antiguo auditado no se utilizó. No se modificó la base operativa ni
se desplegó la aplicación. Backend transaccional compatible debe preceder al frontend.

/**
 * Constantes del módulo de inventario GPS.
 * Centralizadas aquí para evitar strings mágicos repetidos
 * en componentes, filtros y validaciones.
 */

// ── Marcas/modelos disponibles ────────────────────────────────────────────────
export const GPS_BRANDS = [
  { value: 'concox', label: 'Concox' },
  { value: 'suntech', label: 'Suntech' },
  { value: 'queclink', label: 'Queclink' },
  { value: 'teltonika', label: 'Teltonika' },
  { value: 'ruptela', label: 'Ruptela' },
  { value: 'meitrack', label: 'Meitrack' },
  { value: 'otro', label: 'Otro' },
];

// ── Estados del ciclo de vida ──────────────────────────────────────────────────
export const GPS_STATUS = {
  EN_ALMACEN: 'en_almacen',
  ASIGNADO: 'asignado',
  INSTALADO: 'instalado',
  EN_REVISION: 'en_revision',
  DESINSTALADO: 'desinstalado',
  DANADO: 'danado',
  DADO_DE_BAJA: 'dado_de_baja',
};

// ── Metadata visual por estado — color, label, ícono ──────────────────────────
// Los colores usan los tokens de marca EliteTrack (verde para estados "buenos",
// ámbar para estados que requieren atención, rojo para estados críticos)
export const GPS_STATUS_META = {
  [GPS_STATUS.EN_ALMACEN]: {
    label: 'En almacén',
    color: '#4A5056',
    bgColor: 'rgba(74,80,86,0.10)',
  },
  [GPS_STATUS.ASIGNADO]: {
    label: 'Asignado',
    color: '#CC9200',
    bgColor: 'rgba(255,184,0,0.12)',
  },
  [GPS_STATUS.INSTALADO]: {
    label: 'Instalado',
    color: '#00B848',
    bgColor: 'rgba(0,230,91,0.12)',
  },
  [GPS_STATUS.EN_REVISION]: {
    label: 'En revisión',
    color: '#1565C0',
    bgColor: 'rgba(33,150,243,0.12)',
  },
  [GPS_STATUS.DESINSTALADO]: {
    label: 'Desinstalado',
    color: '#4A5056',
    bgColor: 'rgba(74,80,86,0.10)',
  },
  [GPS_STATUS.DANADO]: {
    label: 'Dañado',
    color: '#CC2640',
    bgColor: 'rgba(255,61,87,0.12)',
  },
  [GPS_STATUS.DADO_DE_BAJA]: {
    label: 'Dado de baja',
    color: '#8A9099',
    bgColor: 'rgba(138,144,153,0.10)',
  },
};

// ── Validación de IMEI ────────────────────────────────────────────────────────
// IMEI estándar: 15 dígitos numéricos
export const isValidImei = (imei) => /^\d{15}$/.test(imei?.trim() || '');

// ── Helper para obtener metadata de un estado de forma segura ────────────────
export const getStatusMeta = (status) =>
  GPS_STATUS_META[status] || GPS_STATUS_META[GPS_STATUS.EN_ALMACEN];

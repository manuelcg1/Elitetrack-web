import { Chip } from '@mui/material';
import { getStatusMeta } from './gpsConstants';

/**
 * GpsStatusBadge — Badge reutilizable para mostrar el estado de un GPS.
 *
 * Reutilizable en: tabla de inventario, formulario de edición,
 * módulo de tareas de mantenimiento, timeline de trazabilidad.
 *
 * Props:
 * - status: string — uno de los valores de GPS_STATUS
 * - size: 'small' | 'medium' — tamaño del chip
 */
const GpsStatusBadge = ({ status, size = 'small' }) => {
  const meta = getStatusMeta(status);

  return (
    <Chip
      label={meta.label}
      size={size}
      sx={{
        backgroundColor: meta.bgColor,
        color: meta.color,
        fontWeight: 700,
        fontSize: '0.72rem',
        border: `1px solid ${meta.color}30`,
      }}
    />
  );
};

export default GpsStatusBadge;

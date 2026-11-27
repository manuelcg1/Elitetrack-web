import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import useReadableGeofences from './useReadableGeofences';

// Nombres de todas las geocercas que el usuario puede ver, incluidas las heredadas por carpeta,
// que no siempre están en el listado general. Acepta datos ya cargados para no pedirlos dos veces.
const useGeofenceNames = (shared) => {
  const geofences = useSelector((state) => state.geofences.items);
  const own = useReadableGeofences(!shared);
  const readable = shared || own;

  // Memo: la tabla de posiciones solo se redibuja si cambian los nombres.
  return useMemo(() => {
    const result = {};
    readable.geofences.forEach((geofence) => {
      result[geofence.id] = geofence.name;
    });
    Object.values(geofences).forEach((geofence) => {
      result[geofence.id] = geofence.name;
    });
    return result;
  }, [readable.geofences, geofences]);
};

export default useGeofenceNames;

import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import fetchOrThrow from '../../common/util/fetchOrThrow';

// Nombres de todas las geocercas que el usuario puede ver, incluidas las heredadas por carpeta,
// que no siempre están en el listado general.
const useGeofenceNames = (enabled = true) => {
  const geofences = useSelector((state) => state.geofences.items);
  const [readable, setReadable] = useState({});

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const controller = new AbortController();
    fetchOrThrow('/api/geofences/read-access', { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        const names = {};
        (data.geofences || []).forEach(({ geofence }) => {
          names[geofence.id] = geofence.name;
        });
        setReadable(names);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [enabled]);

  // Memo: la tabla de posiciones solo se redibuja si cambian los nombres.
  return useMemo(() => {
    const result = { ...readable };
    Object.values(geofences).forEach((geofence) => {
      result[geofence.id] = geofence.name;
    });
    return result;
  }, [readable, geofences]);
};

export default useGeofenceNames;

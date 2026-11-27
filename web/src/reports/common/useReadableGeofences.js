import { useEffect, useState } from 'react';
import fetchOrThrow from '../../common/util/fetchOrThrow';

const empty = { loaded: false, folders: [], geofences: [] };

// Carpetas y geocercas que el usuario puede ver, incluidas las heredadas por carpeta.
const useReadableGeofences = (enabled = true) => {
  const [data, setData] = useState(empty);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const controller = new AbortController();
    fetchOrThrow('/api/geofences/read-access', { signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        setData({
          loaded: true,
          folders: payload.folders || [],
          geofences: (payload.geofences || []).map(({ geofence, folderId }) => ({
            ...geofence,
            folderId,
          })),
        });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [enabled]);

  return data;
};

export default useReadableGeofences;

// Projection for consultation only. Never use these flags to authorize writes.
export const readView = (payload) => {
  if (!Array.isArray(payload?.folders) || !Array.isArray(payload?.geofences)) {
    throw new Error('Invalid geofence read-access response');
  }
  return {
    folders: payload.folders,
    geofences: payload.geofences.map((entry) => ({
      ...entry.geofence,
      attributes: { ...entry.geofence.attributes, folderId: entry.folderId },
      readInherited: entry.inherited,
      readDirect: entry.direct,
    })),
  };
};

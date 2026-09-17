// Rows are in depth-first order. Search keeps ancestors but never expands them.
export const visibleAssignmentRows = (rows, expanded, search = '') => {
  const query = search.trim().toLocaleLowerCase();
  const matching = new Set();
  const ancestors = [];
  if (query) {
    for (const row of rows) {
      ancestors.length = row.depth;
      if (
        String(row.name || row.id)
          .toLocaleLowerCase()
          .includes(query)
      ) {
        matching.add(row.key);
        for (const ancestor of ancestors) matching.add(ancestor.key);
      }
      if (row.kind === 'folder') ancestors[row.depth] = row;
    }
  }
  let hiddenBelow = Infinity;
  return rows.filter((row) => {
    if (row.depth > hiddenBelow) return false;
    hiddenBelow = Infinity;
    if (row.kind === 'folder' && !expanded.has(row.id)) hiddenBelow = row.depth;
    return !query || matching.has(row.key);
  });
};

export const assignmentBatch = (userId, before, after) => {
  const batch = { additions: [], removals: [] };
  for (const [collection, key] of [
    ['folders', 'geofenceFolderId'],
    ['geofences', 'geofenceId'],
  ]) {
    const oldIds = new Set(before[collection]);
    const newIds = new Set(after[collection]);
    for (const id of newIds)
      if (!oldIds.has(id)) batch.additions.push({ userId: Number(userId), [key]: id });
    for (const id of oldIds)
      if (!newIds.has(id)) batch.removals.push({ userId: Number(userId), [key]: id });
  }
  return batch;
};

// Iterative traversal avoids recursion limits and never inherits through invalid branches.
export const assignmentRows = (folders, geofences, folderIds, geofenceIds) => {
  const directFolders = new Set(folderIds);
  const directGeofences = new Set(geofenceIds);
  const children = new Map();
  const zones = new Map();
  for (const folder of folders) {
    const parent = Number(folder.parentid || 0);
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(folder);
  }
  for (const geofence of geofences) {
    const raw = geofence.attributes?.folderId;
    const id = typeof raw !== 'boolean' && /^\d+$/.test(String(raw)) ? Number(raw) : 0;
    if (!zones.has(id)) zones.set(id, []);
    zones.get(id).push(geofence);
  }
  const rows = [];
  const visited = new Set();
  const visibleZones = new Set();
  const addZones = (id, depth, inherited) => {
    for (const zone of zones.get(id) || []) {
      visibleZones.add(zone.id);
      rows.push({
        key: `geofence:${zone.id}`,
        id: zone.id,
        name: zone.name,
        kind: 'geofence',
        depth,
        direct: directGeofences.has(zone.id),
        inherited,
        invalid: false,
      });
    }
  };
  const pending = (children.get(0) || [])
    .map((folder) => ({ folder, depth: 0, inherited: false }))
    .reverse();
  while (pending.length) {
    const { folder, depth, inherited } = pending.pop();
    if (visited.has(folder.id)) continue;
    visited.add(folder.id);
    const direct = directFolders.has(folder.id);
    rows.push({
      key: `folder:${folder.id}`,
      id: folder.id,
      name: folder.name,
      kind: 'folder',
      depth,
      direct,
      inherited,
    });
    addZones(folder.id, depth + 1, direct || inherited);
    for (const child of [...(children.get(folder.id) || [])].reverse()) {
      pending.push({ folder: child, depth: depth + 1, inherited: direct || inherited });
    }
  }
  for (const folder of folders)
    if (!visited.has(folder.id)) {
      rows.push({
        key: `folder:${folder.id}`,
        id: folder.id,
        name: folder.name,
        kind: 'folder',
        depth: 0,
        direct: directFolders.has(folder.id),
        inherited: false,
        invalid: true,
      });
    }
  for (const zone of geofences)
    if (!visibleZones.has(zone.id)) {
      rows.push({
        key: `geofence:${zone.id}`,
        id: zone.id,
        name: zone.name,
        kind: 'geofence',
        depth: 0,
        direct: directGeofences.has(zone.id),
        inherited: false,
        invalid: false,
      });
    }
  return rows;
};

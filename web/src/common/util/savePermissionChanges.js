import fetchOrThrow from './fetchOrThrow.js';

export default async ({ previous, next, baseId, keyBase, keyLink, request = fetchOrThrow }) => {
  const relation = (id) => ({ [keyBase]: baseId, [keyLink]: id });
  const previousIds = new Set(previous);
  const nextIds = new Set(next);
  const additions = [...nextIds].filter((id) => !previousIds.has(id)).map(relation);
  const removals = [...previousIds].filter((id) => !nextIds.has(id)).map(relation);
  if (!additions.length && !removals.length) {
    return null;
  }
  return request('/api/permissions/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ additions, removals }),
  });
};

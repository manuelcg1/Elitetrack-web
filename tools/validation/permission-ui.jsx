import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider, useSelector } from 'react-redux';
import store from '/src/store/index.js';
import LinkField from '/src/common/components/LinkField.jsx';
import GeofenceAssignments from '/src/common/components/GeofenceAssignments.jsx';
import { sessionActions } from '/src/store/index.js';
import { LocalizationProvider } from '/src/common/components/LocalizationProvider.jsx';

// Synthetic transport only: authorization itself is covered by the real HTTP Java tests.
store.dispatch(sessionActions.updateUser({ administrator: true, attributes: { language: 'es' } }));
store.dispatch(sessionActions.updateServer({ readonly: false }));
const folders = [{ id: 1, name: 'Lima', parentid: 0 }, { id: 2, name: 'Sedes', parentid: 1 }];
const geofences = [{ id: 100, name: 'Lima · Almacén', attributes: { folderId: 2 } }, { id: 200, name: 'Lima · Taller', attributes: { folderId: 2 } }];
let linkedFolders = [];
let linked = [100];
let scenario = 'normal';
let requests = [];
let update = () => {};
window.fetch = async (url, options = {}) => {
  if (!String(url).startsWith('/api/')) throw new Error('External network disabled');
  if (!options.method) {
    const isFolder = url.includes('geofenceFolders');
    const items = isFolder ? folders : geofences;
    const ids = isFolder ? linkedFolders : linked;
    return Response.json(url.includes('linked') || url.includes('userId=') ? items.filter((g) => ids.includes(g.id)) : items);
  }
  if (url !== '/api/permissions/batch' || options.method !== 'POST') throw new Error('Unexpected write');
  const body = JSON.parse(options.body);
  requests.push(body);
  update();
  const mode = scenario;
  if (mode === 'slow') await new Promise((resolve) => setTimeout(resolve, 5000));
  if (mode === 'readonly') return new Response('Write access denied', { status: 403 });
  if (mode === 'failure') return new Response('Synthetic rollback', { status: 500 });
  linked = linked.filter((id) => !body.removals.some((p) => p.geofenceId === id));
  linked.push(...body.additions.filter((p) => p.geofenceId).map((p) => p.geofenceId));
  linkedFolders = linkedFolders.filter((id) => !body.removals.some((p) => p.geofenceFolderId === id));
  linkedFolders.push(...body.additions.filter((p) => p.geofenceFolderId).map((p) => p.geofenceFolderId));
  update();
  if (mode === 'lost') throw new Error('Synthetic response lost after commit');
  return new Response(null, { status: 204, headers: { 'X-Permission-Refresh': mode === 'warning' ? 'pending' : 'complete' } });
};

function App() {
  const [, render] = useState(0);
  const [key, setKey] = useState(0);
  const errors = useSelector((s) => s.errors.errors);
  update = () => render((v) => v + 1);
  return <main style={{ fontFamily: 'sans-serif', maxWidth: 700, padding: 32 }}>
    <h1>Ensayo aislado de conexiones</h1>
    <p>Componente real; datos y transporte sintéticos. Sin conexión a producción.</p>
    <label>Escenario <select aria-label="Escenario" onChange={(e) => {
      scenario = e.target.value;
      store.dispatch(sessionActions.updateUser({ administrator: scenario !== 'readonly', readonly: scenario === 'readonly', attributes: { language: 'es' } }));
    }}>
      <option value="normal">Guardado normal</option><option value="slow">Respuesta lenta</option>
      <option value="readonly">Solo lectura</option><option value="failure">Fallo antes del commit</option>
      <option value="lost">Respuesta perdida después del commit</option><option value="warning">Advertencia después del commit</option>
    </select></label>
    <button onClick={() => { linked = [100]; linkedFolders = []; requests = []; setKey((v) => v + 1); }}>Reiniciar datos</button>
    <GeofenceAssignments key={`tree-${key}`} userId={1} />
    <div style={{ marginTop: 32 }}><LinkField key={key} label="Geo-Zonas" endpointAll="/api/geofences" endpointLinked="/api/linked" baseId={1} keyBase="userId" keyLink="geofenceId" /></div>
    <button style={{ marginTop: 20 }}>Cambiar foco</button>
    <p>Estado confirmado: {linked.join(', ') || 'vacío'}</p>
    <p>Carpetas confirmadas: {linkedFolders.join(', ') || 'vacío'}</p>
    <p>Peticiones de escritura: {requests.length}</p>
    <pre>{JSON.stringify(requests, null, 2)}</pre>
    <div role="alert">{errors.at(-1)}</div>
  </main>;
}
createRoot(document.getElementById('root')).render(<Provider store={store}><LocalizationProvider><App /></LocalizationProvider></Provider>);

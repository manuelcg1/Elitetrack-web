import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider, useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import store, { sessionActions, geofencesActions } from '/src/store/index.js';
import GeofenceAssignments from '/src/common/components/GeofenceAssignments.jsx';
import AppThemeProvider from '/src/AppThemeProvider.jsx';
import GeofencePanel from '/src/main/GeofencePanel.jsx';
import { LocalizationProvider } from '/src/common/components/LocalizationProvider.jsx';
import { map } from '/src/map/core/MapView.jsx';
import { geofenceToFeature } from '/src/map/core/mapUtil.js';

let actor = 4;
const realFetch = window.fetch.bind(window);
window.fetch = (url, options = {}) => {
  if (!String(url).startsWith('/api/')) throw new Error('Only isolated API calls are permitted');
  return realFetch(url, { ...options, headers: { ...options.headers,
    Authorization: `Basic ${btoa(`user${actor}@example.test:test-password`)}` } });
};
const selectActor = (id) => {
  actor = Number(id);
  store.dispatch(geofencesActions.refresh([]));
  store.dispatch(geofencesActions.clearVisible());
  store.dispatch(sessionActions.updateUser({ id: actor, administrator: actor === 4, readonly: actor === 2,
    attributes: { language: 'es' } }));
};
store.dispatch(sessionActions.updateServer({ readonly: false, attributes: {} }));
selectActor(4);

function TestMap() {
  const hostRef = useRef(null);
  const theme = useTheme();
  const items = useSelector((s) => s.geofences.items);
  const visible = useSelector((s) => s.geofences.visibleIds);
  useEffect(() => {
    hostRef.current.appendChild(map.getContainer());
    map.setStyle({ version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8eef5' } }] });
    map.resize();
  }, []);
  useEffect(() => {
    const draw = () => {
      if (!map.isStyleLoaded()) return;
      const data = { type: 'FeatureCollection', features: visible.filter((id) => items[id]).map((id) => geofenceToFeature(theme, items[id])) };
      if (map.getSource('test-geofences')) map.getSource('test-geofences').setData(data);
      else {
        map.addSource('test-geofences', { type: 'geojson', data });
        map.addLayer({ id: 'test-geofences', type: 'fill', source: 'test-geofences', paint: { 'fill-color': '#00a86b', 'fill-opacity': 0.5 } });
      }
    };
    draw();
    map.on('load', draw);
    return () => map.off('load', draw);
  }, [items, visible, theme]);
  return <div ref={hostRef} style={{ height: 420, flex: 1 }} />;
}
function App() {
  const [user, setUser] = useState(4);
  const errors = useSelector((s) => s.errors.errors);
  const items = useSelector((s) => s.geofences.items);
  const visible = useSelector((s) => s.geofences.visibleIds);
  return <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
    <h1>Ensayo integrado aislado</h1>
    <p>API, autenticación y SQL reales; cuentas sintéticas. Mapa sin proveedor externo.</p>
    <label>Cuenta de prueba <select aria-label="Cuenta de prueba" value={user} onChange={(e) => { selectActor(e.target.value); setUser(Number(e.target.value)); }}>
      <option value={4}>Administrador</option><option value={1}>Usuario heredado</option>
      <option value={2}>Usuario solo lectura</option><option value={3}>Usuario sin menú</option>
    </select></label>
    <p>Editor: {user === 4 ? 'asignaciones del usuario 1' : 'asignaciones de la cuenta actual'}.</p>
    <GeofenceAssignments key={user} userId={user === 4 ? 1 : user} />
    <div style={{ display: 'flex', gap: 24, marginTop: 24 }}><div style={{ width: 400 }}><GeofencePanel key={user} /></div><TestMap /></div>
    <p>Geocercas recibidas: {Object.keys(items).join(', ') || 'ninguna'}</p>
    <p>Geocercas visibles: {visible.join(', ') || 'ninguna'}</p>
    <div role="alert">{errors.at(-1)}</div>
  </main>;
}
createRoot(document.getElementById('root')).render(<Provider store={store}><LocalizationProvider><AppThemeProvider><App /></AppThemeProvider></LocalizationProvider></Provider>);

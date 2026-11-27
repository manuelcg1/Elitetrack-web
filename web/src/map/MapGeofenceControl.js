import { useEffect, useMemo, useRef } from 'react';
import { useTheme } from '@mui/material';
import { map } from './core/MapView';
import './geofenceControl.css';

const icon =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 7l5-3 6 3 5-3v13l-5 3-6-3-5 3z"/><path d="M9 4v13M15 7v13"/></svg>';

class GeofenceControl {
  constructor(onClick) {
    this.onClick = onClick;
  }

  onAdd() {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'maplibre-ctrl-geofences';
    this.button.innerHTML = icon;
    this.badge = document.createElement('span');
    this.badge.className = 'maplibre-ctrl-geofences-badge';
    this.button.appendChild(this.badge);
    this.button.onclick = () => this.onClick(this.button);

    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl-group maplibregl-ctrl';
    this.container.appendChild(this.button);
    return this.container;
  }

  onRemove() {
    this.container.parentNode?.removeChild(this.container);
  }

  update({ count, open, label }) {
    this.badge.textContent = count > 99 ? '99+' : String(count);
    this.badge.hidden = !count;
    this.button.setAttribute('aria-expanded', String(open));
    this.button.setAttribute('aria-haspopup', 'dialog');
    this.button.setAttribute('aria-label', label);
    this.button.title = label;
  }
}

// Botón de geocercas en el grupo de controles del mapa, con la cantidad visible.
const MapGeofenceControl = ({ count, open, label, onClick }) => {
  const theme = useTheme();
  const handlerRef = useRef(onClick);
  handlerRef.current = onClick;
  const control = useMemo(() => new GeofenceControl((element) => handlerRef.current(element)), []);

  useEffect(() => {
    map.addControl(control, theme.direction === 'rtl' ? 'top-left' : 'top-right');
    return () => map.removeControl(control);
  }, [control, theme.direction]);

  useEffect(() => {
    control.update({ count, open, label });
  }, [control, count, open, label]);

  return null;
};

export default MapGeofenceControl;

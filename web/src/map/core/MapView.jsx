import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import { googleProtocol } from 'maplibre-google-maps';
import { useRef, useLayoutEffect, useEffect, useState, useMemo } from 'react';
import { useTheme } from '@mui/material';
import { SwitcherControl } from '../switcher/switcher';
import { useAttributePreference, usePreference } from '../../common/util/preferences';
import usePersistedState, { savePersistedState } from '../../common/util/usePersistedState';
import { mapImages } from './preloadImages';
import useMapStyles from './useMapStyles';
import { useEffectAsync } from '../../reactHelper';

// ── Elemento canvas — creado una sola vez fuera del ciclo React ───────────────
const element = document.createElement('div');
element.style.width = '100%';
element.style.height = '100%';
element.style.boxSizing = 'initial';
element.style.backgroundColor = '#e8e0d8';

maplibregl.addProtocol('google', googleProtocol);

export const map = new maplibregl.Map({
  container: element,
  attributionControl: false,
});

// ── Sistema de listeners para el estado "ready" ───────────────────────────────
let ready = false;
const readyListeners = new Set();

const addReadyListener = (listener) => {
  readyListeners.add(listener);
  listener(ready);
};

const removeReadyListener = (listener) => {
  readyListeners.delete(listener);
};

const updateReadyValue = (value) => {
  ready = value;
  readyListeners.forEach((listener) => listener(value));
};

// ── Carga de imágenes del mapa ────────────────────────────────────────────────
const initMap = () => {
  if (map.hasImage('background')) return;
  Object.entries(mapImages).forEach(([key, value]) => {
    map.addImage(key, value, { pixelRatio: window.devicePixelRatio });
  });
};

// ── Espera a que el mapa esté completamente cargado ───────────────────────────
const waitForMapLoad = () => {
  if (map.loaded()) {
    initMap();
    updateReadyValue(true);
  } else {
    setTimeout(waitForMapLoad, 33);
  }
};

// ── Componente MapView ────────────────────────────────────────────────────────
const MapView = ({ children }) => {
  const theme = useTheme();
  const containerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Flag para saber si el switcher ya fue agregado al mapa
  const switcherAddedRef = useRef(false);
  // Estilos pendientes de aplicar hasta que el switcher esté listo
  const pendingStylesRef = useRef(null);

  const mapStyles = useMapStyles();
  const activeMapStyles = useAttributePreference(
    'activeMapStyles',
    'locationIqStreets,locationIqDark,openFreeMap',
  );
  const [defaultMapStyle] = usePersistedState(
    'selectedMapStyle',
    usePreference('map', 'locationIqStreets'),
  );
  const mapboxAccessToken = useAttributePreference('mapboxAccessToken');
  const maxZoom = useAttributePreference('web.maxZoom');

  // ── Switcher memoizado ──────────────────────────────────────────────────────
  const switcher = useMemo(
    () =>
      new SwitcherControl(
        // onBeforeSwitch — marca el mapa como no listo mientras cambia el estilo
        () => updateReadyValue(false),
        // onSwitch — persiste el estilo seleccionado
        (styleId) => savePersistedState('selectedMapStyle', styleId),
        // onAfterSwitch — espera a que el nuevo estilo cargue completamente
        () => {
          map.once('styledata', () => waitForMapLoad());
        },
      ),
    [],
  );

  // ── Dirección RTL ──────────────────────────────────────────────────────────
  useEffectAsync(async () => {
    if (theme.direction === 'rtl') {
      maplibregl.setRTLTextPlugin('/mapbox-gl-rtl-text.js');
    }
  }, [theme.direction]);

  // ── Agregar controles al mapa ──────────────────────────────────────────────
  // IMPORTANTE: este effect debe ejecutarse antes que el de estilos
  // para garantizar que switcher.map esté definido cuando se llame updateStyles
  useLayoutEffect(() => {
    const currentEl = containerRef.current;
    currentEl.appendChild(element);
    map.resize();

    let resizeTimer;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      // Evita redibujar el canvas en cada frame mientras se arrastra un divisor.
      // Los consumidores interactivos ejecutan map.resize() al finalizar el gesto.
      resizeTimer = setTimeout(() => map.resize(), 120);
    });
    resizeObserver.observe(currentEl);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(resizeTimer);
      currentEl.removeChild(element);
    };
  }, []);

  useEffect(() => {
    const position = theme.direction === 'rtl' ? 'top-left' : 'top-right';
    const attributionPos = theme.direction === 'rtl' ? 'bottom-left' : 'bottom-right';

    const attribution = new maplibregl.AttributionControl({ compact: true });
    const navigation = new maplibregl.NavigationControl();

    map.addControl(attribution, attributionPos);
    map.addControl(navigation, position);

    // Agregar el switcher y marcar que ya está listo para recibir estilos
    map.addControl(switcher, position);
    switcherAddedRef.current = true;

    // Si había estilos pendientes de aplicar, aplicarlos ahora
    if (pendingStylesRef.current) {
      const { styles, defaultStyle } = pendingStylesRef.current;
      switcher.updateStyles(styles, defaultStyle);
      pendingStylesRef.current = null;
    }

    return () => {
      switcherAddedRef.current = false;
      map.removeControl(switcher);
      map.removeControl(navigation);
      map.removeControl(attribution);
    };
  }, [theme.direction, switcher]);

  // ── Zoom máximo ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (maxZoom) map.setMaxZoom(maxZoom);
  }, [maxZoom]);

  // ── Token Mapbox ───────────────────────────────────────────────────────────
  useEffect(() => {
    maplibregl.accessToken = mapboxAccessToken;
  }, [mapboxAccessToken]);

  // ── Actualizar estilos disponibles ─────────────────────────────────────────
  // Garantiza que el switcher ya esté agregado al mapa antes de llamar updateStyles
  useEffect(() => {
    const filtered = mapStyles.filter((s) => s.available && activeMapStyles.includes(s.id));
    const styles = filtered.length ? filtered : mapStyles.filter((s) => s.id === 'osm');

    if (switcherAddedRef.current) {
      // El switcher ya está en el mapa — aplicar inmediatamente
      switcher.updateStyles(styles, defaultMapStyle);
    } else {
      // El switcher aún no fue agregado — guardar para aplicar después
      pendingStylesRef.current = { styles, defaultStyle: defaultMapStyle };
    }
  }, [mapStyles, defaultMapStyle, activeMapStyles, switcher]);

  // ── Listener del estado "ready" ────────────────────────────────────────────
  useEffect(() => {
    const listener = (value) => setMapReady(value);
    addReadyListener(listener);
    return () => removeReadyListener(listener);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#e8e0d8',
      }}
    >
      {mapReady && children}
    </div>
  );
};

export default MapView;

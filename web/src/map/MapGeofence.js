import { useId, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import { map } from './core/MapView';
import { findFonts, geofenceToFeature } from './core/mapUtil';
import { useAttributePreference } from '../common/util/preferences';

/**
 * MapGeofence — Renderiza geocercas en el mapa MapLibre.
 *
 * Solo muestra geocercas donde attributes.visible === true (estrictamente).
 * Geocercas sin el atributo definido o con visible !== true NO se muestran.
 */
const MapGeofence = () => {
  const id = useId();
  const theme = useTheme();
  const mapGeofences = useAttributePreference('mapGeofences', true);
  const geofences = useSelector((state) => state.geofences.items);
  const visibleIds = useSelector((state) => state.geofences.visibleIds);

  // ── Inicializar capas del mapa ────────────────────────────────────────────
  useEffect(() => {
    if (!mapGeofences) return () => {};

    map.addSource(id, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    map.addLayer({
      source: id,
      id: `${id}-fill`,
      type: 'fill',
      filter: ['all', ['==', '$type', 'Polygon']],
      paint: {
        'fill-color': ['get', 'color'],
        'fill-outline-color': ['get', 'color'],
        'fill-opacity': 0.1,
      },
    });

    map.addLayer({
      source: id,
      id: `${id}-line`,
      type: 'line',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'width'],
        'line-opacity': ['get', 'opacity'],
      },
    });

    map.addLayer({
      source: id,
      id: `${id}-title`,
      type: 'symbol',
      layout: {
        'text-field': '{name}',
        'text-font': findFonts(map),
        'text-size': 12,
      },
      paint: {
        'text-halo-color': 'white',
        'text-halo-width': 1,
      },
    });

    return () => {
      if (map.getLayer(`${id}-fill`)) map.removeLayer(`${id}-fill`);
      if (map.getLayer(`${id}-line`)) map.removeLayer(`${id}-line`);
      if (map.getLayer(`${id}-title`)) map.removeLayer(`${id}-title`);
      if (map.getSource(id)) map.removeSource(id);
    };
  }, [mapGeofences]);

  // ── Actualizar features visibles ─────────────────────────────────────────
  useEffect(() => {
    if (mapGeofences) {
      map.getSource(id)?.setData({
        type: 'FeatureCollection',
        features: Object.values(geofences)
          .filter((geofence) => visibleIds.includes(geofence.id))
          .map((geofence) => geofenceToFeature(theme, geofence)),
      });
    }
  }, [mapGeofences, geofences, visibleIds, theme, id]);

  return null;
};

export default MapGeofence;

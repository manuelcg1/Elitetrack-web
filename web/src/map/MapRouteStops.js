import { useEffect, useId } from 'react';
import { useTheme } from '@mui/material/styles';
import { map } from './core/MapView';
import { findFonts } from './core/mapUtil';

const MapRouteStops = ({ positions }) => {
  const id = useId();
  const theme = useTheme();
  const color = theme.palette.error.dark;

  useEffect(() => {
    map.addSource(id, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: `${id}-circle`,
      type: 'circle',
      source: id,
      paint: {
        'circle-radius': 10,
        'circle-color': '#FFFFFF',
        'circle-stroke-color': color,
        'circle-stroke-width': 2,
      },
    });
    map.addLayer({
      id: `${id}-text`,
      type: 'symbol',
      source: id,
      layout: {
        'text-field': 'P',
        'text-font': findFonts(map),
        'text-size': 12,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': color },
    });

    return () => {
      [`${id}-text`, `${id}-circle`].forEach((layer) => {
        if (map.getLayer(layer)) {
          map.removeLayer(layer);
        }
      });
      if (map.getSource(id)) {
        map.removeSource(id);
      }
    };
  }, [id, color]);

  useEffect(() => {
    map.getSource(id)?.setData({
      type: 'FeatureCollection',
      features: positions.map(({ latitude, longitude }) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [longitude, latitude] },
        properties: {},
      })),
    });
  }, [id, color, positions]);

  return null;
};

export default MapRouteStops;

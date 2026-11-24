import { useEffect } from 'react';
import * as maplibregl from 'maplibre-gl';
import { map } from './core/MapView';

const MapCamera = ({ latitude, longitude, positions, coordinates, getPadding }) => {
  useEffect(() => {
    if (coordinates || positions) {
      const coords = coordinates || positions.map((item) => [item.longitude, item.latitude]);
      if (coords.length) {
        const bounds = coords.reduce(
          (bounds, item) => bounds.extend(item),
          new maplibregl.LngLatBounds(coords[0], coords[0]),
        );
        if (getPadding) {
          map.resize();
        }
        const canvas = map.getCanvas();
        map.fitBounds(bounds, {
          padding: getPadding
            ? getPadding(canvas.clientWidth, canvas.clientHeight)
            : Math.min(canvas.width, canvas.height) * 0.1,
          duration: 0,
        });
      }
    } else {
      map.jumpTo({
        center: [longitude, latitude],
        zoom: Math.max(map.getZoom(), 10),
      });
    }
  }, [latitude, longitude, positions, coordinates, getPadding]);

  return null;
};

export default MapCamera;

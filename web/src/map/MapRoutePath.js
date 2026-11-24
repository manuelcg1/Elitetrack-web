import { useTheme } from '@mui/material/styles';
import { useId, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { map } from './core/MapView';
import getSpeedColor from '../common/util/colors';
import { useAttributePreference } from '../common/util/preferences';

const MapRoutePath = ({ positions, color, progress }) => {
  const id = useId();

  const theme = useTheme();

  const reportColor = useSelector((state) => {
    const position = positions?.find(() => true);
    if (position) {
      const attributes = state.devices.items[position.deviceId]?.attributes;
      if (attributes) {
        const color = attributes['web.reportColor'];
        if (color) {
          return color;
        }
      }
    }
    return null;
  });

  const mapLineWidth = useAttributePreference('mapLineWidth', 2);
  const mapLineOpacity = useAttributePreference('mapLineOpacity', 1);

  useEffect(() => {
    map.addSource(id, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [],
        },
      },
    });
    map.addLayer({
      source: id,
      id: `${id}-line`,
      type: 'line',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'width'],
        'line-opacity': ['get', 'opacity'],
      },
    });

    return () => {
      if (map.getLayer(`${id}-line`)) {
        map.removeLayer(`${id}-line`);
      }
      if (map.getSource(id)) {
        map.removeSource(id);
      }
    };
  }, []);

  useEffect(() => {
    const minSpeed = positions.map((p) => p.speed).reduce((a, b) => Math.min(a, b), Infinity);
    const maxSpeed = positions.map((p) => p.speed).reduce((a, b) => Math.max(a, b), -Infinity);
    const features = [];
    for (let i = 0; i < positions.length - 1; i += 1) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [positions[i].longitude, positions[i].latitude],
            [positions[i + 1].longitude, positions[i + 1].latitude],
          ],
        },
        properties: {
          index: i,
          color: color || reportColor || getSpeedColor(positions[i + 1].speed, minSpeed, maxSpeed),
          width: mapLineWidth,
          opacity: mapLineOpacity,
        },
      });
    }
    map.getSource(id)?.setData({
      type: 'FeatureCollection',
      features,
    });
  }, [theme, positions, color, reportColor, mapLineWidth, mapLineOpacity]);

  // Con progress se resalta el tramo recorrido y se atenúa el pendiente.
  useEffect(() => {
    if (progress == null || !map.getLayer(`${id}-line`)) {
      return;
    }
    const pending = ['>=', ['get', 'index'], progress];
    map.setPaintProperty(`${id}-line`, 'line-opacity', [
      'case',
      pending,
      ['*', ['get', 'opacity'], 0.35],
      ['get', 'opacity'],
    ]);
    map.setPaintProperty(`${id}-line`, 'line-width', [
      'case',
      pending,
      ['get', 'width'],
      ['+', ['get', 'width'], 2],
    ]);
  }, [id, progress]);

  return null;
};

export default MapRoutePath;

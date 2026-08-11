import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import maplibregl from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useEffect, useMemo } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { map } from '../core/MapView';
import { findFonts, geofenceToFeature, geometryToArea } from '../core/mapUtil';
import { errorsActions, geofencesActions } from '../../store';
import { useCatchCallback } from '../../reactHelper';
import drawTheme from './theme';
import { useTranslation } from '../../common/components/LocalizationProvider';
import fetchOrThrow from '../../common/util/fetchOrThrow';

MapboxDraw.constants.classes.CONTROL_BASE = 'maplibregl-ctrl';
MapboxDraw.constants.classes.CONTROL_PREFIX = 'maplibregl-ctrl-';
MapboxDraw.constants.classes.CONTROL_GROUP = 'maplibregl-ctrl-group';

const MapGeofenceEdit = ({
  selectedGeofenceId,
  folderId = 0,
  geofenceType,
  circleCenter,
  circleRadius,
  onCircleCenterChange,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useTranslation();

  const draw = useMemo(
    () =>
      new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          line_string: true,
          trash: true,
        },
        userProperties: true,
        styles: [
          ...drawTheme,
          {
            id: 'gl-draw-title',
            type: 'symbol',
            filter: ['all'],
            layout: {
              'text-field': '{user_name}',
              'text-font': findFonts(map),
              'text-size': 12,
            },
            paint: {
              'text-color': '#20252b',
              'text-halo-color': 'white',
              'text-halo-width': 2,
              'text-halo-blur': 0.5,
            },
          },
        ],
      }),
    [],
  );

  const geofences = useSelector((state) => state.geofences.items);
  const visibleIds = useSelector((state) => state.geofences.visibleIds);

  const refreshGeofences = useCatchCallback(async () => {
    const response = await fetchOrThrow('/api/geofences');
    dispatch(geofencesActions.refresh(await response.json()));
  }, [dispatch]);

  useEffect(() => {
    refreshGeofences();

    map.addControl(draw, theme.direction === 'rtl' ? 'top-right' : 'top-left');
    return () => map.removeControl(draw);
  }, [refreshGeofences, draw, theme.direction]);

  useEffect(() => {
    if (!geofenceType) return;

    if (geofenceType === 'polygon') {
      draw.changeMode('draw_polygon');
    } else if (geofenceType === 'polyline') {
      draw.changeMode('draw_line_string');
    }
  }, [draw, geofenceType]);

  useEffect(() => {
    if (geofenceType !== 'circle') return () => {};

    const listener = (event) => {
      onCircleCenterChange?.({
        latitude: Number(event.lngLat.lat.toFixed(7)),
        longitude: Number(event.lngLat.lng.toFixed(7)),
      });
    };
    map.on('click', listener);
    map.getCanvas().style.cursor = 'crosshair';
    return () => {
      map.off('click', listener);
      map.getCanvas().style.cursor = '';
    };
  }, [geofenceType, onCircleCenterChange]);

  useEffect(() => {
    if (
      geofenceType !== 'circle' ||
      !circleCenter ||
      !Number.isFinite(circleRadius) ||
      circleRadius <= 0
    ) {
      return () => {};
    }

    const sourceId = 'geofence-circle-preview';
    const fillId = `${sourceId}-fill`;
    const lineId = `${sourceId}-line`;
    const feature = geofenceToFeature(theme, {
      id: sourceId,
      name: `${circleRadius} m`,
      area: `CIRCLE (${circleCenter.latitude} ${circleCenter.longitude}, ${circleRadius})`,
      attributes: {},
    });

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data: feature });
      map.addLayer({
        id: fillId,
        source: sourceId,
        type: 'fill',
        paint: {
          'fill-color': theme.palette.success.main,
          'fill-opacity': 0.2,
        },
      });
      map.addLayer({
        id: lineId,
        source: sourceId,
        type: 'line',
        paint: {
          'line-color': theme.palette.success.main,
          'line-width': 3,
        },
      });
    } else {
      map.getSource(sourceId).setData(feature);
    }

    const coordinates = feature.geometry.coordinates[0];
    const bounds = coordinates.reduce(
      (current, coordinate) => current.extend(coordinate),
      new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
    );
    map.fitBounds(bounds, {
      padding: Math.min(map.getCanvas().width, map.getCanvas().height) * 0.15,
      maxZoom: 17,
      duration: 400,
    });

    return () => {
      if (map.getLayer(fillId)) map.removeLayer(fillId);
      if (map.getLayer(lineId)) map.removeLayer(lineId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [circleCenter, circleRadius, geofenceType, theme]);

  useEffect(() => {
    const listener = async (event) => {
      const feature = event.features[0];

      const newItem = {
        name: t('sharedGeofence'),
        area: geometryToArea(feature.geometry),
        attributes: {
          folderId,
        },
      };

      draw.delete(feature.id);

      try {
        const response = await fetchOrThrow('/api/geofences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem),
        });

        const item = await response.json();
        dispatch(geofencesActions.update([item]));
        navigate(`/settings/geofence/${item.id}`);
      } catch (error) {
        dispatch(errorsActions.push(error.message));
      }
    };

    map.on('draw.create', listener);
    return () => map.off('draw.create', listener);
  }, [dispatch, navigate, t, draw, folderId]);

  useEffect(() => {
    const listener = async (event) => {
      const feature = event.features[0];
      try {
        await fetchOrThrow(`/api/geofences/${feature.id}`, { method: 'DELETE' });
        refreshGeofences();
      } catch (error) {
        dispatch(errorsActions.push(error.message));
      }
    };

    map.on('draw.delete', listener);
    return () => map.off('draw.delete', listener);
  }, [dispatch, refreshGeofences]);

  useEffect(() => {
    const listener = async (event) => {
      const feature = event.features[0];
      const item = Object.values(geofences).find((i) => i.id === feature.id);

      if (item) {
        if (item.area.startsWith('CIRCLE')) {
          refreshGeofences();
          return;
        }
        const updatedItem = {
          ...item,
          area: geometryToArea(feature.geometry),
        };

        try {
          await fetchOrThrow(`/api/geofences/${feature.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedItem),
          });
          refreshGeofences();
        } catch (error) {
          dispatch(errorsActions.push(error.message));
        }
      }
    };

    map.on('draw.update', listener);
    return () => map.off('draw.update', listener);
  }, [dispatch, geofences, refreshGeofences]);

  useEffect(() => {
    draw.deleteAll();
    Object.values(geofences).forEach((geofence) => {
      if (visibleIds.includes(geofence.id)) {
        draw.add(geofenceToFeature(theme, geofence));
      }
    });
  }, [geofences, visibleIds, draw, theme]);

  useEffect(() => {
    if (selectedGeofenceId) {
      const feature = draw.get(selectedGeofenceId);
      if (!feature) return;

      let { coordinates } = feature.geometry;
      if (Array.isArray(coordinates[0][0])) {
        [coordinates] = coordinates;
      }

      const bounds = coordinates.reduce(
        (bounds, coordinate) => bounds.extend(coordinate),
        new maplibregl.LngLatBounds(coordinates[0], coordinates[1]),
      );

      const canvas = map.getCanvas();
      map.fitBounds(bounds, { padding: Math.min(canvas.width, canvas.height) * 0.1 });
    }
  }, [selectedGeofenceId, draw]);

  return null;
};

export default MapGeofenceEdit;

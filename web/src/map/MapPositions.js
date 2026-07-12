import { useId, useCallback, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useSelector } from 'react-redux';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { map } from './core/MapView';
import { mapIconKey } from './core/preloadImages';
import { useAttributePreference } from '../common/util/preferences';
import { useCatchCallback } from '../reactHelper';
import { findFonts } from './core/mapUtil';
import {
  createSmartVehicleMarkerElement,
  getSmartMarkerDetail,
  updateSmartVehicleMarkerElement,
} from './SmartVehicleMarker';
import { getVehicleStatus } from './utils/vehicleStatus';
import './SmartVehicleMarker.css';

const DEBUG_MARKER_ANCHOR = false;

const isValidCoordinate = (value, min, max) => {
  const coordinate = Number(value);
  return (
    value !== null &&
    value !== '' &&
    Number.isFinite(coordinate) &&
    coordinate >= min &&
    coordinate <= max
  );
};

const isValidLatitude = (value) => isValidCoordinate(value, -90, 90);

const isValidLongitude = (value) => isValidCoordinate(value, -180, 180);

const isValidPosition = (position) =>
  !!position && isValidLatitude(position.latitude) && isValidLongitude(position.longitude);

const warnInvalidPosition = (position) => {
  if (import.meta.env.DEV) {
    console.warn('Posición GPS inválida; se omitió el marcador.', {
      deviceId: position?.deviceId,
      longitude: position?.longitude,
      latitude: position?.latitude,
    });
  }
};

const getMarkerLngLat = (item) => {
  if (!item) {
    return null;
  }

  if (isValidPosition(item.position)) {
    return [Number(item.position.longitude), Number(item.position.latitude)];
  }

  if (isValidPosition(item)) {
    return [Number(item.longitude), Number(item.latitude)];
  }

  if (item.lngLat && isValidLongitude(item.lngLat.lng) && isValidLatitude(item.lngLat.lat)) {
    return [Number(item.lngLat.lng), Number(item.lngLat.lat)];
  }

  const coordinates = item.geometry?.coordinates || item.coordinates;
  if (
    Array.isArray(coordinates) &&
    coordinates.length >= 2 &&
    isValidLongitude(coordinates[0]) &&
    isValidLatitude(coordinates[1])
  ) {
    return [Number(coordinates[0]), Number(coordinates[1])];
  }

  return null;
};

const MapPositions = ({ positions, onMapClick, onMarkerClick, selectedPosition }) => {
  const id = useId();
  const clusters = `${id}-clusters`;
  const selected = `${id}-selected`;
  const smartMarkersRef = useRef(new Map());
  const markerDataRef = useRef(new Map());

  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const iconScale = useAttributePreference('iconScale', desktop ? 0.75 : 1);

  const devices = useSelector((state) => state.devices.items);
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);

  const mapCluster = useAttributePreference('mapCluster', true);
  const directionType = useAttributePreference('mapDirection', 'selected');
  const selectedDeviceIdRef = useRef(selectedDeviceId);
  const mapClusterRef = useRef(mapCluster);
  const onMarkerClickRef = useRef(onMarkerClick);

  selectedDeviceIdRef.current = selectedDeviceId;
  mapClusterRef.current = mapCluster;
  onMarkerClickRef.current = onMarkerClick;

  const createFeature = useCallback(
    (deviceItems, position, selectedPositionId) => {
      const device = deviceItems[position.deviceId];
      let showDirection;
      switch (directionType) {
        case 'none':
          showDirection = false;
          break;
        case 'all':
          showDirection = position.course > 0;
          break;
        default:
          showDirection = selectedPositionId === position.id && position.course > 0;
          break;
      }
      return {
        id: position.id,
        deviceId: position.deviceId,
        name: device?.name,
        category: mapIconKey(device?.category),
        rotation: position.course,
        direction: showDirection,
      };
    },
    [directionType],
  );

  const onMouseEnter = () => (map.getCanvas().style.cursor = 'pointer');
  const onMouseLeave = () => (map.getCanvas().style.cursor = '');

  const onMapClickCallback = useCallback(
    (event) => {
      const lngLat = getMarkerLngLat(event);
      if (!event.defaultPrevented && onMapClick && lngLat) {
        onMapClick(lngLat[1], lngLat[0]);
      }
    },
    [onMapClick],
  );

  const onClusterClick = useCatchCallback(
    async (event) => {
      event.preventDefault();
      const features = map.queryRenderedFeatures(event.point, {
        layers: [clusters],
      });
      const feature = features[0];
      const center = getMarkerLngLat(feature);
      const clusterId = feature?.properties?.cluster_id;
      if (!center || clusterId === undefined) {
        return;
      }
      const zoom = await map.getSource(id).getClusterExpansionZoom(clusterId);
      map.easeTo({
        center,
        zoom,
      });
    },
    [clusters],
  );

  const removeSmartMarkers = useCallback(() => {
    smartMarkersRef.current.forEach(({ marker, debugMarker }) => {
      marker.remove();
      debugMarker?.remove();
    });
    smartMarkersRef.current.clear();
  }, []);

  const updateSmartMarkers = useCallback(() => {
    const source = map.getSource(id);
    // Conservar la ultima visibilidad mientras MapLibre reconstruye la fuente.
    // Consultarla durante ese intervalo produce resultados parciales y parpadeos.
    if (!source || !map.isSourceLoaded(id)) {
      return;
    }

    const detail = getSmartMarkerDetail(map.getZoom());
    const currentSelectedDeviceId = selectedDeviceIdRef.current;
    const currentMapCluster = mapClusterRef.current;
    const wanted = new Set();
    const bounds = map.getBounds();
    const isVisible = (item) => {
      const lngLat = getMarkerLngLat(item);
      return !!lngLat && bounds.contains(lngLat);
    };

    try {
      map
        .querySourceFeatures(id)
        .filter((feature) => !feature.properties?.point_count)
        .forEach((feature) => {
          const featureLngLat = getMarkerLngLat(feature);
          const deviceId = Number(feature.properties?.deviceId);
          const data = markerDataRef.current.get(deviceId);
          if (featureLngLat && data && isVisible(data.position)) {
            wanted.add(deviceId);
          }
        });
    } catch {
      markerDataRef.current.forEach((_, deviceId) => {
        const data = markerDataRef.current.get(deviceId);
        if (
          data &&
          isVisible(data.position) &&
          (!currentMapCluster || deviceId !== currentSelectedDeviceId)
        ) {
          wanted.add(deviceId);
        }
      });
    }
    if (!wanted.size && (!currentMapCluster || map.getZoom() >= 14)) {
      markerDataRef.current.forEach((data, deviceId) => {
        if (isVisible(data.position) && deviceId !== currentSelectedDeviceId) {
          wanted.add(deviceId);
        }
      });
    }

    if (currentSelectedDeviceId && markerDataRef.current.has(currentSelectedDeviceId)) {
      const data = markerDataRef.current.get(currentSelectedDeviceId);
      if (data && isValidPosition(data.position)) {
        wanted.add(currentSelectedDeviceId);
      }
    }

    smartMarkersRef.current.forEach(({ element, debugMarker }, deviceId) => {
      const data = markerDataRef.current.get(deviceId);
      // Los elementos fuera del viewport permanecen montados y conservan su
      // visibilidad. El contenedor de MapLibre los recorta de forma natural.
      // Solo reconciliamos clustering para puntos actualmente visibles.
      if (!data || !isVisible(data.position)) {
        return;
      }
      const visible = wanted.has(deviceId);
      element.style.display = visible ? '' : 'none';
      debugMarker?.getElement().style.setProperty('display', visible ? '' : 'none');
    });

    wanted.forEach((deviceId) => {
      const data = markerDataRef.current.get(deviceId);
      const lngLat = getMarkerLngLat(data);
      if (!data || !lngLat) {
        return;
      }
      let entry = smartMarkersRef.current.get(deviceId);
      if (!entry) {
        const element = createSmartVehicleMarkerElement();
        element.addEventListener('click', (event) => {
          event.stopPropagation();
          if (onMarkerClickRef.current) {
            onMarkerClickRef.current(Number(element.dataset.positionId), deviceId);
          }
        });
        entry = {
          element,
          longitude: lngLat[0],
          latitude: lngLat[1],
          marker: new maplibregl.Marker({
            element,
            anchor: 'bottom',
            offset: [0, 0],
          })
            .setLngLat(lngLat)
            .addTo(map),
          debugMarker:
            DEBUG_MARKER_ANCHOR && import.meta.env.DEV
              ? new maplibregl.Marker({ color: '#0066ff', scale: 0.25 })
                  .setLngLat(lngLat)
                  .addTo(map)
              : null,
        };
        smartMarkersRef.current.set(deviceId, entry);
      }
      entry.element.style.display = '';
      entry.debugMarker?.getElement().style.setProperty('display', '');
      if (entry.longitude !== lngLat[0] || entry.latitude !== lngLat[1]) {
        entry.marker.setLngLat(lngLat);
        entry.debugMarker?.setLngLat(lngLat);
        entry.longitude = lngLat[0];
        entry.latitude = lngLat[1];
      }
      updateSmartVehicleMarkerElement(entry.element, {
        device: data.device,
        position: data.position,
        status: data.status,
        detail,
        selected: deviceId === currentSelectedDeviceId,
      });
    });
  }, [id]);

  useEffect(() => {
    map.addSource(id, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
      cluster: mapCluster,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });
    map.addSource(selected, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });
    [id, selected].forEach((source) => {
      map.addLayer({
        id: `direction-${source}`,
        type: 'symbol',
        source,
        filter: ['all', ['!has', 'point_count'], ['==', 'direction', true]],
        layout: {
          'icon-image': 'direction',
          'icon-size': iconScale,
          'icon-allow-overlap': true,
          'icon-rotate': ['get', 'rotation'],
          'icon-rotation-alignment': 'map',
        },
      });
    });
    map.addLayer({
      id: clusters,
      type: 'symbol',
      source: id,
      filter: ['has', 'point_count'],
      layout: {
        'icon-image': 'background',
        'icon-size': iconScale,
        'text-field': '{point_count_abbreviated}',
        'text-font': findFonts(map),
        'text-size': 14,
      },
    });

    map.on('mouseenter', clusters, onMouseEnter);
    map.on('mouseleave', clusters, onMouseLeave);
    map.on('click', clusters, onClusterClick);
    map.on('click', onMapClickCallback);
    map.on('moveend', updateSmartMarkers);
    map.on('zoomend', updateSmartMarkers);
    map.on('idle', updateSmartMarkers);

    return () => {
      map.off('mouseenter', clusters, onMouseEnter);
      map.off('mouseleave', clusters, onMouseLeave);
      map.off('click', clusters, onClusterClick);
      map.off('click', onMapClickCallback);
      map.off('moveend', updateSmartMarkers);
      map.off('zoomend', updateSmartMarkers);
      map.off('idle', updateSmartMarkers);
      removeSmartMarkers();

      if (map.getLayer(clusters)) {
        map.removeLayer(clusters);
      }

      [id, selected].forEach((source) => {
        if (map.getLayer(`direction-${source}`)) {
          map.removeLayer(`direction-${source}`);
        }
        if (map.getSource(source)) {
          map.removeSource(source);
        }
      });
    };
  }, [
    mapCluster,
    clusters,
    iconScale,
    id,
    onClusterClick,
    onMapClickCallback,
    removeSmartMarkers,
    selected,
    updateSmartMarkers,
  ]);

  useEffect(() => {
    const validPositions = (positions || []).filter((position) => {
      if (!devices.hasOwnProperty(position.deviceId)) {
        return false;
      }
      if (!isValidPosition(position)) {
        warnInvalidPosition(position);
        return false;
      }
      return true;
    });

    markerDataRef.current = new Map(
      validPositions.map((position) => {
        const normalizedPosition = {
          ...position,
          latitude: Number(position.latitude),
          longitude: Number(position.longitude),
          deviceStatus: devices[position.deviceId]?.status,
        };
        return [
          normalizedPosition.deviceId,
          {
            position: normalizedPosition,
            device: devices[normalizedPosition.deviceId],
            status: getVehicleStatus(normalizedPosition),
          },
        ];
      }),
    );

    smartMarkersRef.current.forEach(({ marker, debugMarker }, deviceId) => {
      if (!markerDataRef.current.has(deviceId)) {
        marker.remove();
        debugMarker?.remove();
        smartMarkersRef.current.delete(deviceId);
      }
    });

    [id, selected].forEach((source) => {
      map.getSource(source)?.setData({
        type: 'FeatureCollection',
        features: validPositions
          .filter((it) =>
            source === id ? it.deviceId !== selectedDeviceId : it.deviceId === selectedDeviceId,
          )
          .map((position) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [Number(position.longitude), Number(position.latitude)],
            },
            properties: createFeature(devices, position, selectedPosition && selectedPosition.id),
          })),
      });
    });
    window.requestAnimationFrame(updateSmartMarkers);
  }, [
    createFeature,
    devices,
    id,
    positions,
    selected,
    selectedDeviceId,
    selectedPosition,
    updateSmartMarkers,
  ]);

  return null;
};

export default MapPositions;

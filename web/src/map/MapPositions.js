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
import './SmartVehicleMarker.css';

const MapPositions = ({
  positions,
  onMapClick,
  onMarkerClick,
  selectedPosition,
}) => {
  const id = useId();
  const clusters = `${id}-clusters`;
  const selected = `${id}-selected`;
  const smartMarkers = useRef(new Map());
  const markerData = useRef(new Map());

  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const iconScale = useAttributePreference('iconScale', desktop ? 0.75 : 1);

  const devices = useSelector((state) => state.devices.items);
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);

  const mapCluster = useAttributePreference('mapCluster', true);
  const directionType = useAttributePreference('mapDirection', 'selected');

  const createFeature = (devices, position, selectedPositionId) => {
    const device = devices[position.deviceId];
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
      name: device.name,
      category: mapIconKey(device.category),
      rotation: position.course,
      direction: showDirection,
    };
  };

  const onMouseEnter = () => (map.getCanvas().style.cursor = 'pointer');
  const onMouseLeave = () => (map.getCanvas().style.cursor = '');

  const onMapClickCallback = useCallback(
    (event) => {
      if (!event.defaultPrevented && onMapClick) {
        onMapClick(event.lngLat.lat, event.lngLat.lng);
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
      const clusterId = features[0].properties.cluster_id;
      const zoom = await map.getSource(id).getClusterExpansionZoom(clusterId);
      map.easeTo({
        center: features[0].geometry.coordinates,
        zoom,
      });
    },
    [clusters],
  );

  const removeSmartMarkers = useCallback(() => {
    smartMarkers.current.forEach(({ marker }) => marker.remove());
    smartMarkers.current.clear();
  }, []);

  const updateSmartMarkers = useCallback(() => {
    const source = map.getSource(id);
    if (!source) {
      return;
    }

    const detail = getSmartMarkerDetail(map.getZoom());
    const wanted = new Set();
    const bounds = map.getBounds();
    const isVisible = ({ longitude, latitude }) =>
      Number.isFinite(longitude) && Number.isFinite(latitude) && bounds.contains([longitude, latitude]);

    try {
      map.querySourceFeatures(id)
        .filter((feature) => !feature.properties?.point_count)
        .forEach((feature) => {
          const data = markerData.current.get(Number(feature.properties.deviceId));
          if (data && isVisible(data.position)) {
            wanted.add(Number(feature.properties.deviceId));
          }
        });
    } catch {
      markerData.current.forEach((_, deviceId) => {
        const data = markerData.current.get(deviceId);
        if (data && isVisible(data.position) && (!mapCluster || deviceId !== selectedDeviceId)) {
          wanted.add(deviceId);
        }
      });
    }
    if (!wanted.size && (!mapCluster || map.getZoom() >= 14)) {
      markerData.current.forEach((data, deviceId) => {
        if (isVisible(data.position) && deviceId !== selectedDeviceId) {
          wanted.add(deviceId);
        }
      });
    }

    if (selectedDeviceId && markerData.current.has(selectedDeviceId)) {
      wanted.add(selectedDeviceId);
    }

    smartMarkers.current.forEach(({ marker }, deviceId) => {
      if (!wanted.has(deviceId)) {
        marker.remove();
        smartMarkers.current.delete(deviceId);
      }
    });

    wanted.forEach((deviceId) => {
      const data = markerData.current.get(deviceId);
      if (!data) {
        return;
      }
      let entry = smartMarkers.current.get(deviceId);
      if (!entry) {
        const element = createSmartVehicleMarkerElement();
        element.addEventListener('click', (event) => {
          event.stopPropagation();
          if (onMarkerClick) {
            onMarkerClick(Number(element.dataset.positionId), deviceId);
          }
        });
        entry = {
          element,
          marker: new maplibregl.Marker({
            element,
            anchor: 'bottom',
            offset: [0, -8],
          }).addTo(map),
        };
        smartMarkers.current.set(deviceId, entry);
      }
      entry.marker.setLngLat([data.position.longitude, data.position.latitude]);
      updateSmartVehicleMarkerElement(entry.element, {
        device: data.device,
        position: data.position,
        detail,
        selected: deviceId === selectedDeviceId,
      });
    });
  }, [id, mapCluster, onMarkerClick, selectedDeviceId]);

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
    map.on('sourcedata', updateSmartMarkers);

    return () => {
      map.off('mouseenter', clusters, onMouseEnter);
      map.off('mouseleave', clusters, onMouseLeave);
      map.off('click', clusters, onClusterClick);
      map.off('click', onMapClickCallback);
      map.off('moveend', updateSmartMarkers);
      map.off('zoomend', updateSmartMarkers);
      map.off('sourcedata', updateSmartMarkers);
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
    onClusterClick,
    onMapClickCallback,
    removeSmartMarkers,
    updateSmartMarkers,
  ]);

  useEffect(() => {
    markerData.current = new Map(
      positions
        .filter((it) => devices.hasOwnProperty(it.deviceId))
        .filter((it) => Number.isFinite(it.longitude) && Number.isFinite(it.latitude))
        .map((position) => [
          position.deviceId,
          {
            position,
            device: devices[position.deviceId],
          },
        ]),
    );

    [id, selected].forEach((source) => {
      map.getSource(source)?.setData({
        type: 'FeatureCollection',
        features: positions
          .filter((it) => devices.hasOwnProperty(it.deviceId))
          .filter((it) => Number.isFinite(it.longitude) && Number.isFinite(it.latitude))
          .filter((it) =>
            source === id ? it.deviceId !== selectedDeviceId : it.deviceId === selectedDeviceId,
          )
          .map((position) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [position.longitude, position.latitude],
            },
            properties: createFeature(devices, position, selectedPosition && selectedPosition.id),
          })),
      });
    });
    window.requestAnimationFrame(updateSmartMarkers);
  }, [
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

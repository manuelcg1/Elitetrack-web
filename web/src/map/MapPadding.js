import { useEffect } from 'react';

import { map } from './core/MapView';
import { useTheme } from '@mui/material';

export const normalizePadding = (padding = {}) =>
  Object.fromEntries(
    ['top', 'right', 'bottom', 'left'].map((key) => [
      key,
      Number.isFinite(padding[key]) ? padding[key] : 0,
    ]),
  );

export const canUseMap = (mapInstance) => {
  if (!mapInstance || typeof mapInstance.setPadding !== 'function') {
    return false;
  }
  try {
    if (typeof mapInstance.loaded === 'function' && !mapInstance.loaded()) {
      return false;
    }
    if (typeof mapInstance.getCenter !== 'function') {
      return false;
    }
    const center = mapInstance.getCenter();
    return Number.isFinite(center?.lng) && Number.isFinite(center?.lat);
  } catch {
    return false;
  }
};

const MapPadding = ({ start }) => {
  const theme = useTheme();

  useEffect(() => {
    const startKey = theme.direction === 'rtl' ? 'right' : 'left';
    const topStart = document.querySelector(`.maplibregl-ctrl-top-${startKey}`);
    const bottomStart = document.querySelector(`.maplibregl-ctrl-bottom-${startKey}`);
    if (topStart) {
      topStart.style.insetInlineStart = `${start}px`;
    }
    if (bottomStart) {
      bottomStart.style.insetInlineStart = `${start}px`;
    }
    if (canUseMap(map)) {
      map.setPadding(normalizePadding({ [startKey]: start }));
    }
    return () => {
      if (topStart) {
        topStart.style.insetInlineStart = 0;
      }
      if (bottomStart) {
        bottomStart.style.insetInlineStart = 0;
      }
      if (canUseMap(map)) {
        map.setPadding(normalizePadding());
      }
    };
  }, [start, theme.direction]);

  return null;
};

export default MapPadding;

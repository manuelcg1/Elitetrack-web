import { speedFromKnots } from '../common/util/converter';
import { mapIcons, mapIconKey } from './core/preloadImages';

export const SMART_MARKER_DETAIL = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

const eliteGreen = '#00c853';

const statusMeta = {
  moving: { color: '#16a34a' },
  stopped: { color: '#94a3b8' },
  ignition: { color: '#f59e0b' },
  offline: { color: '#1f2937' },
};

export const getSmartMarkerDetail = (zoom) => {
  if (zoom < 8.5) {
    return SMART_MARKER_DETAIL.LOW;
  }
  if (zoom < 12) {
    return SMART_MARKER_DETAIL.MEDIUM;
  }
  return SMART_MARKER_DETAIL.HIGH;
};

const getVehicleState = (device, position) => {
  if (device?.status === 'offline' || device?.status === 'unknown') {
    return 'offline';
  }
  const speed = Number(position?.speed || 0);
  if (speed > 0.5 || position?.attributes?.motion) {
    return 'moving';
  }
  if (position?.attributes?.ignition) {
    return 'ignition';
  }
  return 'stopped';
};

const formatSpeed = (position) => Math.round(speedFromKnots(Number(position?.speed || 0), 'kmh'));

const truncateName = (name) => {
  const value = name || 'Vehiculo';
  return value.length > 21 ? `${value.slice(0, 19)}...` : value;
};

const getIconSource = (category) => mapIcons[mapIconKey(category)] || mapIcons.default;

export const createSmartVehicleMarkerElement = () => {
  const element = document.createElement('div');
  element.className = 'smart-vehicle-marker';
  element.innerHTML = `
    <div class="smart-vehicle-marker-icon">
      <img alt="" />
    </div>
    <div class="smart-vehicle-marker-content">
      <div class="smart-vehicle-marker-name"></div>
      <div class="smart-vehicle-marker-speed">
        <span class="smart-vehicle-marker-status-dot"></span>
        <span class="smart-vehicle-marker-speed-value"></span>
      </div>
    </div>
  `;
  return element;
};

export const updateSmartVehicleMarkerElement = (
  element,
  {
    device,
    position,
    detail = SMART_MARKER_DETAIL.HIGH,
    selected = false,
  },
) => {
  const state = getVehicleState(device, position);
  const color = statusMeta[state]?.color || eliteGreen;
  const speed = formatSpeed(position);
  const previousSpeed = element.dataset.speed;

  element.dataset.deviceId = String(device?.id || position.deviceId);
  element.dataset.positionId = String(position.id);
  element.dataset.speed = String(speed);
  element.style.setProperty('--marker-accent', color);
  element.style.setProperty('--marker-border', selected ? '#1976d2' : eliteGreen);
  element.style.setProperty('--marker-speed-width', `${Math.min(speed, 140) / 1.4}%`);
  element.className = [
    'smart-vehicle-marker',
    `smart-vehicle-marker-${detail}`,
    selected ? 'smart-vehicle-marker-selected' : '',
  ].filter(Boolean).join(' ');

  const icon = element.querySelector('.smart-vehicle-marker-icon img');
  const name = element.querySelector('.smart-vehicle-marker-name');
  const speedValue = element.querySelector('.smart-vehicle-marker-speed-value');

  icon.src = getIconSource(device?.category);
  name.textContent = truncateName(device?.name || device?.uniqueId);
  speedValue.textContent = `${speed} km/h`;

  if (previousSpeed !== undefined && previousSpeed !== String(speed)) {
    element.classList.remove('smart-vehicle-marker-pulse');
    window.requestAnimationFrame(() => element.classList.add('smart-vehicle-marker-pulse'));
  }
};

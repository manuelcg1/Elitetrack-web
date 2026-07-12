import { speedFromKnots } from '../common/util/converter';
import { mapIcons, mapIconKey } from './core/preloadImages';
import { getVehicleStatus } from './utils/vehicleStatus';

export const SMART_MARKER_DETAIL = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
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

const formatSpeed = (position) => Math.round(speedFromKnots(Number(position?.speed || 0), 'kmh'));

const truncateName = (name) => {
  const value = name || 'Vehiculo';
  return value.length > 21 ? `${value.slice(0, 19)}...` : value;
};

const getIconSource = (category) => {
  const iconKey = mapIconKey(category);
  return mapIcons[iconKey === 'default' ? 'car' : iconKey] || mapIcons.car;
};

export const createSmartVehicleMarkerElement = () => {
  const element = document.createElement('div');
  element.className = 'smart-vehicle-marker';
  element.innerHTML = `
    <div class="smart-vehicle-marker-content">
      <div class="smart-vehicle-marker-name"></div>
      <div class="smart-vehicle-marker-speed">
        <span class="smart-vehicle-marker-status-dot"></span>
        <span class="smart-vehicle-marker-speed-value"></span>
      </div>
    </div>
    <div class="smart-vehicle-marker-icon">
      <img alt="" />
    </div>
  `;
  return element;
};

export const updateSmartVehicleMarkerElement = (
  element,
  { device, position, status, detail = SMART_MARKER_DETAIL.HIGH, selected = false },
) => {
  if (!element || !position) {
    return;
  }

  const vehicleStatus = status || getVehicleStatus(position);
  const speed = formatSpeed(position);
  const previousSpeed = element.dataset.speed;

  element.dataset.deviceId = String(device?.id || position.deviceId || '');
  element.dataset.positionId = String(position.id || '');
  element.dataset.speed = String(speed);
  element.dataset.vehicleState = vehicleStatus.state;
  element.setAttribute('aria-label', `${device?.name || 'Vehículo'}: ${vehicleStatus.label}`);
  element.style.setProperty('--marker-accent', vehicleStatus.color);
  element.style.setProperty('--marker-background', vehicleStatus.background);
  element.style.setProperty('--marker-glow', vehicleStatus.glow);
  element.style.setProperty('--marker-speed-width', `${Math.min(speed, 140) / 1.4}%`);
  element.className = [
    'smart-vehicle-marker',
    `smart-vehicle-marker-${detail}`,
    selected ? 'smart-vehicle-marker-selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const icon = element.querySelector('.smart-vehicle-marker-icon img');
  const name = element.querySelector('.smart-vehicle-marker-name');
  const speedValue = element.querySelector('.smart-vehicle-marker-speed-value');

  if (icon) {
    icon.src = getIconSource(device?.category);
  }
  if (name) {
    name.textContent = truncateName(device?.name || device?.uniqueId);
  }
  if (speedValue) {
    speedValue.textContent = `${speed} km/h`;
  }

  if (previousSpeed !== undefined && previousSpeed !== String(speed)) {
    element.classList.remove('smart-vehicle-marker-pulse');
    window.requestAnimationFrame(() => element.classList.add('smart-vehicle-marker-pulse'));
  }
};

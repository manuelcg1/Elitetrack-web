import { VehicleStatusTheme } from '../../common/theme/vehicleStatusTheme';

const vehicleStatusLabels = Object.freeze({
  moving: 'En movimiento',
  stopped: 'Detenido',
  idle: 'Motor encendido',
  offline: 'Sin conexión',
});

/**
 * Devuelve la identidad visual actual del vehículo.
 *
 * `deviceStatus` debe contener el estado calculado por Traccar, que ya aplica
 * el tiempo de desconexión configurado en el servidor.
 */
export const getVehicleStatus = (position) => {
  let state;
  const deviceStatus = position?.deviceStatus ?? position?.status;
  const speed = Number(position?.speed);

  if (deviceStatus === 'offline' || deviceStatus === 'unknown') {
    state = 'offline';
  } else if (Number.isFinite(speed) && speed > 0) {
    state = 'moving';
  } else if (position?.attributes?.ignition === true) {
    state = 'idle';
  } else {
    state = 'stopped';
  }

  return {
    state,
    label: vehicleStatusLabels[state],
    ...VehicleStatusTheme[state],
  };
};

export default getVehicleStatus;

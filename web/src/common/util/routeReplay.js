const EARTH_RADIUS = 6371000;
const CHART_BUCKETS = 300;
const MIN_STOP_DURATION = 3 * 60 * 1000;

export const isStopped = (position) =>
  typeof position.attributes?.motion === 'boolean' ? !position.attributes.motion : !position.speed;

const distanceBetween = (a, b) => {
  const radians = Math.PI / 180;
  const value =
    Math.sin(((b.latitude - a.latitude) * radians) / 2) ** 2 +
    Math.cos(a.latitude * radians) *
      Math.cos(b.latitude * radians) *
      Math.sin(((b.longitude - a.longitude) * radians) / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(value)));
};

// Distancia acumulada en metros hasta cada posición.
export const accumulateDistance = (positions) => {
  let total = 0;
  return positions.map((position, index) => {
    if (index > 0) {
      const { distance } = position.attributes || {};
      total += Number.isFinite(distance)
        ? distance
        : distanceBetween(positions[index - 1], position);
    }
    return total;
  });
};

// Primera posición de cada parada de al menos tres minutos.
export const findStops = (positions) => {
  const stops = [];
  let start = -1;
  const close = (end) => {
    if (
      start >= 0 &&
      Date.parse(positions[end].fixTime) - Date.parse(positions[start].fixTime) >= MIN_STOP_DURATION
    ) {
      stops.push(positions[start]);
    }
    start = -1;
  };
  positions.forEach((position, index) => {
    if (!isStopped(position)) {
      close(index);
    } else if (start < 0) {
      start = index;
    }
  });
  if (positions.length) {
    close(positions.length - 1);
  }
  return stops;
};

export const nextIndex = (positions, index, skipStops) => {
  const last = positions.length - 1;
  let next = Math.min(index + 1, last);
  while (skipStops && next < last && isStopped(positions[next])) {
    next += 1;
  }
  return next;
};

// Resume la ruta para que el gráfico no dependa de la cantidad de posiciones.
export const buildSpeedChart = (positions) => {
  const count = Math.min(CHART_BUCKETS, positions.length);
  const maxSpeed = positions.reduce((max, { speed }) => Math.max(max, speed), 0) || 1;
  return Array.from({ length: count }, (_, bucket) => {
    const from = Math.floor((bucket * positions.length) / count);
    const to = Math.floor(((bucket + 1) * positions.length) / count);
    const items = positions.slice(from, to);
    return {
      value: items.reduce((max, { speed }) => Math.max(max, speed), 0) / maxSpeed,
      stopped: items.every(isStopped),
    };
  });
};

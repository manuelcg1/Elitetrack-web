// Eventos de la campana del mapa que se conservan al recargar.
//
// La campana (EventsDrawer) se llena con los eventos que llegan por WebSocket, y eso
// solo pasa con las notificaciones que tienen el canal "web". Al recargar, la lista
// se vaciaba. Aquí se reconstruye desde el servidor con los eventos de las últimas
// horas que habrían generado una notificación web para el usuario:
//   1. Notificaciones del usuario con canal "web".
//   2. Eventos del reporte de esos tipos (y alarmas) en la ventana de tiempo.
//   3. Solo los de dispositivos a los que aplica alguna de esas notificaciones:
//      las marcadas "todos los dispositivos" o las vinculadas al dispositivo o a
//      uno de sus grupos.
// Lo que el usuario borró de la campana se recuerda en localStorage para no
// volver a mostrarlo.

export const RECENT_EVENTS_HOURS = 24;
export const RECENT_EVENTS_LIMIT = 50;

const HOUR_MS = 60 * 60 * 1000;

const splitList = (value) =>
  (value || '')
    .split(/[, ]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const getJson = async (url) => {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }
  return response.json();
};

// ── Eventos borrados de la campana ───────────────────────────
const dismissedKey = (userId) => `eventsDismissed:${userId}`;

const readDismissed = (userId) => {
  try {
    const value = JSON.parse(window.localStorage.getItem(dismissedKey(userId)));
    if (value && typeof value === 'object') {
      return { clearedBefore: Number(value.clearedBefore) || 0, ids: value.ids || {} };
    }
  } catch {
    // localStorage no disponible o valor dañado
  }
  return { clearedBefore: 0, ids: {} };
};

const writeDismissed = (userId, dismissed) => {
  const limit = Date.now() - RECENT_EVENTS_HOURS * HOUR_MS;
  const ids = Object.fromEntries(
    Object.entries(dismissed.ids).filter(([, time]) => Number(time) >= limit),
  );
  try {
    window.localStorage.setItem(
      dismissedKey(userId),
      JSON.stringify({ clearedBefore: dismissed.clearedBefore, ids }),
    );
  } catch {
    // sin localStorage: el borrado dura hasta recargar
  }
};

export const dismissRecentEvent = (userId, event) => {
  if (!userId || !event?.id) return;
  const dismissed = readDismissed(userId);
  dismissed.ids[event.id] = Date.parse(event.eventTime) || Date.now();
  writeDismissed(userId, dismissed);
};

export const dismissAllRecentEvents = (userId) => {
  if (!userId) return;
  writeDismissed(userId, { clearedBefore: Date.now(), ids: {} });
};

const isDismissed = (dismissed, event) =>
  Boolean(dismissed.ids[event.id]) || (Date.parse(event.eventTime) || 0) <= dismissed.clearedBefore;

// ── Notificaciones aplicables ────────────────────────────────
const matchesNotification = (notification, event) => {
  if (notification.type !== event.type) return false;
  if (event.type !== 'alarm') return true;
  const alarms = splitList(notification.attributes?.alarms);
  return !alarms.length || alarms.includes(event.attributes?.alarm);
};

const groupChain = (groupId, groupsById) => {
  const chain = [];
  let current = groupId;
  while (current && !chain.includes(current)) {
    chain.push(current);
    current = groupsById[current]?.groupId;
  }
  return chain;
};

export const loadRecentEvents = async ({ userId, devices, hours = RECENT_EVENTS_HOURS }) => {
  const notifications = (await getJson('/api/notifications')).filter((item) =>
    splitList(item.notificators).includes('web'),
  );
  if (!notifications.length) return [];

  const types = [...new Set(notifications.map((item) => item.type))];
  const alarmNotifications = notifications.filter((item) => item.type === 'alarm');
  const alarmFilter = alarmNotifications.some((item) => !splitList(item.attributes?.alarms).length)
    ? []
    : [...new Set(alarmNotifications.flatMap((item) => splitList(item.attributes?.alarms)))];

  const to = new Date();
  const from = new Date(to.getTime() - hours * HOUR_MS);
  const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  types.forEach((type) => query.append('type', type));
  alarmFilter.forEach((alarm) => query.append('alarm', alarm));

  const dismissed = readDismissed(userId);
  const candidates = (await getJson(`/api/reports/events?${query.toString()}`)).filter(
    (event) =>
      event.id &&
      !isDismissed(dismissed, event) &&
      notifications.some((notification) => matchesNotification(notification, event)),
  );
  if (!candidates.length) return [];

  const always = notifications.filter((item) => item.always);
  const webIds = new Set(notifications.map((item) => item.id));
  const needsLinks = notifications.length > always.length;

  let groupsById = {};
  if (needsLinks) {
    try {
      groupsById = Object.fromEntries((await getJson('/api/groups')).map((g) => [g.id, g]));
    } catch {
      // sin grupos visibles: solo vínculos directos al dispositivo
    }
  }

  const linkCache = {};
  const linkedIds = (scope, id) => {
    const key = `${scope}:${id}`;
    if (!linkCache[key]) {
      linkCache[key] = getJson(`/api/notifications?${scope}=${id}`)
        .then((items) => items.map((item) => item.id).filter((itemId) => webIds.has(itemId)))
        .catch(() => []);
    }
    return linkCache[key];
  };

  const applicableByDevice = {};
  const deviceIds = [...new Set(candidates.map((event) => event.deviceId))];
  await Promise.all(
    deviceIds.map(async (deviceId) => {
      const ids = new Set(always.map((item) => item.id));
      if (needsLinks) {
        const scopes = [
          ['deviceId', deviceId],
          ...groupChain(devices[deviceId]?.groupId, groupsById).map((id) => ['groupId', id]),
        ];
        (await Promise.all(scopes.map(([scope, id]) => linkedIds(scope, id))))
          .flat()
          .forEach((id) => ids.add(id));
      }
      applicableByDevice[deviceId] = notifications.filter((item) => ids.has(item.id));
    }),
  );

  return candidates
    .filter((event) =>
      (applicableByDevice[event.deviceId] || []).some((notification) =>
        matchesNotification(notification, event),
      ),
    )
    .sort((a, b) => (Date.parse(b.eventTime) || 0) - (Date.parse(a.eventTime) || 0))
    .slice(0, RECENT_EVENTS_LIMIT);
};

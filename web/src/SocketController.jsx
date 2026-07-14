import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector, connect } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { alertEventsActions, devicesActions, sessionActions } from './store';
import { useCatchCallback, useEffectAsync } from './reactHelper';
import alarm from './resources/alarm.mp3';
import { eventsActions } from './store/events';
import useFeatures from './common/util/useFeatures';
import { useAttributePreference } from './common/util/preferences';
import {
  handleNativeNotificationListeners,
  nativePostMessage,
} from './common/components/NativeInterface';
import fetchOrThrow from './common/util/fetchOrThrow';
import AlertPopupStack from './common/components/AlertPopupStack';

const logoutCode = 4000;
const reconnectDelayMs = 3000;
const maxPopups = 5;

const eventTitles = {
  speed: 'Exceso de velocidad',
  deviceOverspeed: 'Exceso de velocidad',
  geofenceEnter: 'Entrada a geocerca',
  geofenceExit: 'Salida de geocerca',
  hardCornering: 'Giro brusco',
  hardBraking: 'Frenado brusco',
  hardAcceleration: 'Aceleración brusca',
  batteryLow: 'Voltaje bajo',
  ignitionOn: 'Motor encendido',
  ignitionOff: 'Motor apagado',
  deviceMoving: 'Vehículo en movimiento',
  deviceStopped: 'Vehículo detenido',
  stoppedTooLong: 'Vehículo detenido',
  deviceOffline: 'Desconexión GPS',
  deviceOnline: 'Reconexión GPS',
};

const canonicalType = (type) =>
  ({
    deviceOverspeed: 'speed',
    deviceStopped: 'stoppedTooLong',
  })[type] || type;

const titleFor = (type, fallback) =>
  fallback ||
  eventTitles[type] ||
  type?.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (value) => value.toUpperCase()) ||
  'Alerta';

const SocketController = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const authenticated = useSelector((state) => Boolean(state.session.user));
  const includeLogs = useSelector((state) => state.session.includeLogs);
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);

  const socketRef = useRef();
  const connectSocketRef = useRef();
  const reconnectTimeoutRef = useRef();
  const handleEventsRef = useRef();
  const handleAlertEventsRef = useRef();

  const clearReconnectTimeout = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const [notifications, setNotifications] = useState([]);

  const soundEvents = useAttributePreference('soundEvents', '');
  const soundAlarms = useAttributePreference('soundAlarms', 'sos');
  const popupMode = useAttributePreference('alertPopupMode', 'all');
  const popupEnabled = useAttributePreference('alertPopups', true);
  const popupSound = useAttributePreference('alertPopupSound', true);
  const popupAutoClose = useAttributePreference('alertPopupAutoClose', true);
  const popupDuration = useAttributePreference('alertPopupDuration', 10);
  const popupVolume = useAttributePreference('alertPopupVolume', 80);
  const popupRepeatSound = useAttributePreference('alertPopupRepeatSound', false);

  const features = useFeatures();

  const playPopupSound = useCallback(() => {
    if (!popupSound) {
      return;
    }
    const audio = new Audio(alarm);
    audio.volume = Math.min(1, Math.max(0, Number(popupVolume) / 100));
    audio.play().catch(() => {});
    if (popupRepeatSound) {
      audio.addEventListener(
        'ended',
        () => {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        },
        { once: true },
      );
    }
  }, [popupRepeatSound, popupSound, popupVolume]);

  const addPopups = useCallback(
    (items) => {
      const visible = items.filter(
        (item) => popupMode === 'all' || (popupMode === 'critical' && item.severity === 'critical'),
      );
      if (popupEnabled && popupMode !== 'none' && visible.length) {
        setNotifications((current) => {
          const dedupeKeys = new Set(
            visible.map((item) => `${item.deviceId}-${canonicalType(item.type)}`),
          );
          return [
            ...current.filter(
              (item) => !dedupeKeys.has(`${item.deviceId}-${canonicalType(item.type)}`),
            ),
            ...visible,
          ].slice(-maxPopups);
        });
      }
    },
    [popupEnabled, popupMode],
  );

  const handleEvents = useCallback(
    (events) => {
      if (!features.disableEvents) {
        dispatch(eventsActions.add(events));
      }
      const shouldPlay = events.some(
        (e) =>
          soundEvents.includes(e.type) ||
          (e.type === 'alarm' && soundAlarms.includes(e.attributes?.alarm)),
      );
      if (shouldPlay) {
        new Audio(alarm).play().catch(() => {});
      }
      addPopups(
        events.map((event) => {
          const position = positions[event.deviceId];
          const type = event.type === 'alarm' ? event.attributes?.alarm || event.type : event.type;
          return {
            key: `event-${event.id}-${type}`,
            type,
            severity: event.attributes?.severity || (type === 'deviceOffline' ? 'high' : 'medium'),
            title: titleFor(type),
            message: event.attributes?.message,
            deviceId: event.deviceId,
            deviceName: devices[event.deviceId]?.name,
            time: event.eventTime ? new Date(event.eventTime).toLocaleString() : null,
            address: event.attributes?.address || position?.address,
            latitude: position?.latitude,
            longitude: position?.longitude,
          };
        }),
      );
    },
    [addPopups, devices, dispatch, features, positions, soundAlarms, soundEvents],
  );

  const handleAlertEvents = useCallback(
    (events) => {
      dispatch(alertEventsActions.receive(events));
      if (events.length) {
        playPopupSound();
      }
      addPopups(
        events.map((event) => ({
          key: `alert-${event.id}`,
          type: event.type,
          severity: event.severity || 'medium',
          title: titleFor(event.type, event.alertName),
          message: event.message,
          deviceId: event.deviceId,
          deviceName: event.deviceName || devices[event.deviceId]?.name,
          driverName: event.driverName,
          valueText: event.value
            ? `${event.type === 'speed' ? 'Velocidad' : 'Valor'}: ${event.value.toFixed?.(1) || event.value} ${event.unit || ''}`
            : null,
          time: event.eventTime ? new Date(event.eventTime).toLocaleString() : null,
          address: event.address,
          latitude: event.latitude,
          longitude: event.longitude,
        })),
      );
    },
    [addPopups, devices, dispatch, playPopupSound],
  );

  useEffect(() => {
    handleEventsRef.current = handleEvents;
    handleAlertEventsRef.current = handleAlertEvents;
  }, [handleAlertEvents, handleEvents]);

  const connectSocket = () => {
    clearReconnectTimeout();
    if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
      socketRef.current.close();
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/socket`);
    socketRef.current = socket;

    socket.onopen = () => {
      dispatch(sessionActions.updateSocket(true));
    };

    socket.onclose = async (event) => {
      dispatch(sessionActions.updateSocket(false));
      if (event.code !== logoutCode) {
        try {
          const devicesResponse = await fetch('/api/devices');
          if (devicesResponse.ok) {
            dispatch(devicesActions.update(await devicesResponse.json()));
          }
          const positionsResponse = await fetch('/api/positions');
          if (positionsResponse.ok) {
            dispatch(sessionActions.updatePositions(await positionsResponse.json()));
          }
          if (devicesResponse.status === 401 || positionsResponse.status === 401) {
            navigate('/login');
          }
        } catch {
          // ignore errors
        }
        clearReconnectTimeout();
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connectSocketRef.current?.();
        }, reconnectDelayMs);
      }
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.devices) {
        dispatch(devicesActions.update(data.devices));
      }
      if (data.positions) {
        dispatch(sessionActions.updatePositions(data.positions));
      }
      if (data.events) {
        handleEventsRef.current?.(data.events);
      }
      if (data.alertEvents) {
        handleAlertEventsRef.current?.(data.alertEvents);
      }
      if (data.logs) {
        dispatch(sessionActions.updateLogs(data.logs));
      }
    };
  };

  connectSocketRef.current = connectSocket;

  useEffect(() => {
    socketRef.current?.send(JSON.stringify({ logs: includeLogs }));
  }, [includeLogs]);

  useEffectAsync(async () => {
    if (authenticated) {
      const response = await fetchOrThrow('/api/devices');
      dispatch(devicesActions.refresh(await response.json()));
      nativePostMessage('authenticated');
      connectSocketRef.current?.();
      return () => {
        clearReconnectTimeout();
        socketRef.current?.close(logoutCode);
      };
    }
    return null;
  }, [authenticated]);

  const handleNativeNotification = useCatchCallback(
    async (message) => {
      const eventId = message.data.eventId;
      if (eventId) {
        const response = await fetch(`/api/events/${eventId}`);
        if (response.ok) {
          const event = await response.json();
          const eventWithMessage = {
            ...event,
            attributes: { ...event.attributes, message: message.notification.body },
          };
          handleEvents([eventWithMessage]);
        }
      }
    },
    [handleEvents],
  );

  useEffect(() => {
    handleNativeNotificationListeners.add(handleNativeNotification);
    return () => handleNativeNotificationListeners.delete(handleNativeNotification);
  }, [handleNativeNotification]);

  useEffect(() => {
    if (!authenticated) return;
    const reconnectIfNeeded = () => {
      const socket = socketRef.current;
      if (!socket || socket.readyState === WebSocket.CLOSED) {
        connectSocketRef.current?.();
      } else if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send('{}');
        } catch {
          // test connection
        }
      }
    };
    const onVisibility = () => {
      if (!document.hidden) {
        reconnectIfNeeded();
      }
    };
    window.addEventListener('online', reconnectIfNeeded);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('online', reconnectIfNeeded);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [authenticated]);

  const handlePopupClose = useCallback((key) => {
    setNotifications((current) => current.filter((item) => item.key !== key));
  }, []);

  const handlePopupLocation = useCallback(
    (notification) => {
      const hasLocation =
        notification.latitude != null &&
        notification.longitude != null &&
        notification.latitude !== '' &&
        notification.longitude !== '' &&
        Number.isFinite(Number(notification.latitude)) &&
        Number.isFinite(Number(notification.longitude));
      dispatch(devicesActions.selectId(notification.deviceId));
      navigate('/', {
        state: {
          notificationDeviceId: notification.deviceId,
          notificationLocation: hasLocation
            ? [Number(notification.longitude), Number(notification.latitude)]
            : null,
        },
      });
    },
    [dispatch, navigate],
  );

  return (
    <AlertPopupStack
      notifications={notifications}
      autoClose={popupAutoClose}
      duration={Math.max(1, Number(popupDuration)) * 1000}
      onClose={handlePopupClose}
      onLocation={handlePopupLocation}
    />
  );
};

export default connect()(SocketController);

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, IconButton, Paper, Slide, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SpeedIcon from '@mui/icons-material/Speed';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import CarCrashIcon from '@mui/icons-material/CarCrash';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PowerIcon from '@mui/icons-material/Power';
import BatteryAlertIcon from '@mui/icons-material/BatteryAlert';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import WifiIcon from '@mui/icons-material/Wifi';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';

const severityColors = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#FBC02D',
  low: '#1976D2',
};

const iconByType = {
  speed: SpeedIcon,
  deviceOverspeed: SpeedIcon,
  hardCornering: RotateRightIcon,
  hardBraking: CarCrashIcon,
  hardAcceleration: TrendingUpIcon,
  geofenceEnter: LocationOnIcon,
  geofenceExit: LocationOnIcon,
  ignitionOn: PowerIcon,
  ignitionOff: PowerIcon,
  batteryLow: BatteryAlertIcon,
  deviceMoving: DirectionsCarIcon,
  stoppedTooLong: DirectionsCarIcon,
  deviceStopped: DirectionsCarIcon,
  deviceOffline: WifiOffIcon,
  deviceOnline: WifiIcon,
};

const AlertPopup = ({ notification, autoClose, duration, onClose, onLocation }) => {
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(duration);
  const startedAtRef = useRef(0);
  const color = severityColors[notification.severity] || severityColors.medium;
  const AlertIcon = iconByType[notification.type] || NotificationsActiveIcon;
  const handleClose = useCallback(() => onClose(notification.key), [notification.key, onClose]);
  const handleLocation = useCallback(() => onLocation(notification), [notification, onLocation]);

  useEffect(() => {
    if (!autoClose || paused) {
      return undefined;
    }
    startedAtRef.current = Date.now();
    const timeout = setTimeout(handleClose, remainingRef.current);
    return () => {
      clearTimeout(timeout);
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (Date.now() - startedAtRef.current),
      );
    };
  }, [autoClose, handleClose, paused]);

  return (
    <Slide direction="left" in mountOnEnter>
      <Paper
        elevation={10}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        sx={{
          width: { xs: 'calc(100vw - 24px)', sm: 380 },
          maxWidth: 420,
          borderLeft: `5px solid ${color}`,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ p: 2 }}>
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <Box
              sx={{
                display: 'grid',
                placeItems: 'center',
                width: 34,
                height: 34,
                flex: '0 0 auto',
                borderRadius: '50%',
                color,
                bgcolor: `${color}18`,
              }}
            >
              <AlertIcon fontSize="small" />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} noWrap>
                {notification.title}
              </Typography>
              {notification.deviceName && (
                <Typography variant="body2">
                  <strong>Vehículo:</strong> {notification.deviceName}
                </Typography>
              )}
              {notification.valueText && (
                <Typography variant="body2">{notification.valueText}</Typography>
              )}
              {notification.driverName && (
                <Typography variant="body2">
                  <strong>Conductor:</strong> {notification.driverName}
                </Typography>
              )}
              {notification.time && (
                <Typography variant="body2">
                  <strong>Fecha:</strong> {notification.time}
                </Typography>
              )}
              {notification.address && (
                <Typography variant="body2" sx={{ mt: 0.25 }} noWrap title={notification.address}>
                  <strong>Ubicación:</strong> {notification.address}
                </Typography>
              )}
              {!notification.deviceName && notification.message && (
                <Typography variant="body2">{notification.message}</Typography>
              )}
            </Box>
            <IconButton size="small" aria-label="Cerrar" onClick={handleClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
          {notification.deviceId > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Button size="small" startIcon={<LocationOnIcon />} onClick={handleLocation}>
                Ver ubicación
              </Button>
            </Box>
          )}
        </Box>
      </Paper>
    </Slide>
  );
};

const AlertPopupStack = ({ notifications, autoClose, duration, onClose, onLocation }) => (
  <Stack
    spacing={1.25}
    sx={{
      position: 'fixed',
      zIndex: (theme) => theme.zIndex.snackbar,
      top: { xs: 72, sm: 20 },
      right: { xs: 12, sm: 20 },
      pointerEvents: 'none',
      alignItems: 'flex-end',
    }}
  >
    {notifications.map((notification) => (
      <Box key={notification.key} sx={{ pointerEvents: 'auto' }}>
        <AlertPopup
          notification={notification}
          autoClose={autoClose}
          duration={duration}
          onClose={onClose}
          onLocation={onLocation}
        />
      </Box>
    ))}
  </Stack>
);

export default AlertPopupStack;

import { useCallback, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Paper, Typography } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import MapView, { map } from '../map/core/MapView';
import MapSelectedDevice from '../map/main/MapSelectedDevice';
import MapAccuracy from '../map/main/MapAccuracy';
import MapGeofence from '../map/MapGeofence';
import MapCurrentLocation from '../map/MapCurrentLocation';
import PoiMap from '../map/main/PoiMap';
import MapPadding from '../map/MapPadding';
import { devicesActions } from '../store';
import MapDefaultCamera from '../map/main/MapDefaultCamera';
import MapLiveRoutes from '../map/main/MapLiveRoutes';
import MapPositions from '../map/MapPositions';
import MapOverlay from '../map/overlay/MapOverlay';
import MapGeocoder from '../map/geocoder/MapGeocoder';
import MapScale from '../map/MapScale';
import MapNotification from '../map/notification/MapNotification';
import useFeatures from '../common/util/useFeatures';

const MainMap = ({
  filteredPositions,
  selectedPosition,
  onEventsClick,
  desktopPadding,
  notificationLocation,
  hasVisibleDevices,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const eventsAvailable = useSelector((state) => !!state.events.items.length);

  const features = useFeatures();

  useEffect(() => {
    if (notificationLocation) {
      map.easeTo({
        center: notificationLocation,
        zoom: Math.max(map.getZoom(), 15),
      });
    }
  }, [notificationLocation]);

  const onMarkerClick = useCallback(
    (_, deviceId) => {
      dispatch(devicesActions.selectId(deviceId));
    },
    [dispatch],
  );

  return (
    <>
      <MapView>
        <MapOverlay />
        <MapGeofence />
        <MapAccuracy positions={filteredPositions} />
        <MapLiveRoutes deviceIds={filteredPositions.map((p) => p.deviceId)} />
        <MapPositions
          positions={filteredPositions}
          onMarkerClick={onMarkerClick}
          selectedPosition={selectedPosition}
          showStatus
        />
        <MapDefaultCamera
          filteredPositions={filteredPositions}
          selectedPosition={selectedPosition}
        />
        {selectedPosition && <MapSelectedDevice />}
        <PoiMap />
      </MapView>
      {!hasVisibleDevices && (
        <Paper
          elevation={2}
          sx={{
            pointerEvents: 'none',
            position: 'fixed',
            zIndex: 4,
            top: { xs: 72, md: 20 },
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: 'calc(100% - 32px)',
            px: 2,
            py: 1,
            borderRadius: 2,
            textAlign: 'center',
            opacity: 0.92,
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            No hay dispositivos visibles
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Activa los switches para mostrarlos en el mapa.
          </Typography>
        </Paper>
      )}
      <MapScale />
      <MapCurrentLocation />
      <MapGeocoder />
      {!features.disableEvents && (
        <MapNotification enabled={eventsAvailable} onClick={onEventsClick} />
      )}
      {desktop && (
        <MapPadding
          start={
            desktopPadding ??
            parseInt(theme.dimensions.drawerWidthDesktop, 10) + parseInt(theme.spacing(1.5), 10)
          }
        />
      )}
    </>
  );
};

export default MainMap;

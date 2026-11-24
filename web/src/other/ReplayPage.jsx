import { useState, useEffect, useMemo, useCallback } from 'react';
import { IconButton, Paper, Toolbar, Typography, useMediaQuery, useTheme } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import TuneIcon from '@mui/icons-material/Tune';
import DownloadIcon from '@mui/icons-material/Download';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import MapView, { map } from '../map/core/MapView';
import MapRoutePath from '../map/MapRoutePath';
import MapRoutePoints from '../map/MapRoutePoints';
import MapPositions from '../map/MapPositions';
import MapRouteStops from '../map/MapRouteStops';
import ReportFilter, { updateReportParams } from '../reports/components/ReportFilter';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useCatch } from '../reactHelper';
import MapCamera from '../map/MapCamera';
import MapGeofence from '../map/MapGeofence';
import StatusCard from '../common/components/StatusCard';
import MapScale from '../map/MapScale';
import BackIcon from '../common/components/BackIcon';
import fetchOrThrow from '../common/util/fetchOrThrow';
import MapOverlay from '../map/overlay/MapOverlay';
import { useRestriction } from '../common/util/permissions';
import usePersistedState from '../common/util/usePersistedState';
import { findStops, nextIndex } from '../common/util/routeReplay';
import { isRouteColor } from '../reports/components/RouteColorSelect';
import ReplayPlayer, { replayRates } from './ReplayPlayer';

const POINT_INTERVAL = 500;
const MIN_INTERVAL = 62.5;
const FOLLOW_ZOOM = 14;
const PANEL_SPACE = 360;

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    position: 'relative',
    [theme.breakpoints.down('md')]: {
      display: 'flex',
      flexDirection: 'column',
    },
  },
  map: {
    height: '100%',
    [theme.breakpoints.down('md')]: {
      order: 2,
      flex: '1 1 0',
      height: 'auto',
      minHeight: 0,
    },
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    zIndex: 3,
    left: 0,
    top: 0,
    margin: theme.spacing(1.5),
    maxHeight: `calc(100% - ${theme.spacing(3)})`,
    width: theme.dimensions.drawerWidthDesktop,
    [theme.breakpoints.down('md')]: {
      display: 'contents',
    },
  },
  header: {
    flexShrink: 0,
    [theme.breakpoints.down('md')]: {
      order: 1,
      zIndex: 1,
    },
  },
  title: {
    flexGrow: 1,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2),
    overflowX: 'hidden',
    overflowY: 'auto',
    '& > *': {
      flexShrink: 0,
    },
    [theme.breakpoints.down('md')]: {
      order: 1,
      flexShrink: 0,
      maxHeight: '70%',
    },
    [theme.breakpoints.up('md')]: {
      marginTop: theme.spacing(1),
    },
  },
  player: {
    [theme.breakpoints.down('md')]: {
      order: 3,
      maxHeight: '58%',
      zIndex: 1,
      borderRadius: '16px 16px 0 0',
    },
  },
}));

const ReplayPage = () => {
  const t = useTranslation();
  const { classes, cx } = useStyles();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const navigate = useNavigate();
  const disableReports = useRestriction('disableReports');

  const [searchParams, setSearchParams] = useSearchParams();

  const defaultDeviceId = useSelector((state) => state.devices.selectedId);

  const [positions, setPositions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selectedDeviceId, setSelectedDeviceId] = useState(defaultDeviceId);
  const [showCard, setShowCard] = useState(false);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  const [storedColor, setLineColor] = usePersistedState('reportPositionsLineColor', null);
  const lineColor = isRouteColor(storedColor) ? storedColor : null;
  const [storedRate, setRate] = usePersistedState('replayRate', 1);
  const rate = replayRates.includes(storedRate) ? storedRate : 1;
  const [follow, setFollow] = usePersistedState('replayFollow', false);
  const [skipStops, setSkipStops] = usePersistedState('replaySkipStops', false);

  const stops = useMemo(() => findStops(positions), [positions]);

  const loaded = Boolean(from && to && !loading && positions.length);

  useEffect(() => {
    if (disableReports) {
      navigate('/', { replace: true });
    }
  }, [disableReports, navigate]);

  useEffect(() => {
    if (!from && !to) {
      setPositions([]);
      setIndex(0);
      setPlaying(false);
    }
  }, [from, to, setPositions]);

  useEffect(() => {
    if (!playing || !positions.length) {
      return undefined;
    }
    // A velocidades altas se avanzan varios puntos por ciclo en vez de redibujar más seguido.
    const interval = Math.max(POINT_INTERVAL / rate, MIN_INTERVAL);
    const steps = Math.round((interval * rate) / POINT_INTERVAL);
    const timer = setInterval(() => {
      setIndex((current) => {
        let next = current;
        for (let i = 0; i < steps; i += 1) {
          next = nextIndex(positions, next, skipStops);
        }
        return next;
      });
    }, interval);
    return () => clearInterval(timer);
  }, [playing, positions, rate, skipStops]);

  useEffect(() => {
    if (index >= positions.length - 1) {
      setPlaying(false);
    }
  }, [index, positions]);

  const goTo = useCallback(
    (value) => setIndex(Math.max(0, Math.min(value, positions.length - 1))),
    [positions],
  );

  const togglePlay = useCallback(() => {
    if (!playing && index >= positions.length - 1) {
      setIndex(0);
    }
    setPlaying(!playing && positions.length > 1);
  }, [playing, index, positions]);

  useEffect(() => {
    if (!loaded) {
      return undefined;
    }
    const onKeyDown = (event) => {
      const { target } = event;
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        target.closest?.(
          'input, textarea, select, [role="combobox"], [role="slider"], .MuiModal-root, .maplibregl-map',
        ) ||
        (event.key === ' ' && target.closest?.('button, a'))
      ) {
        return;
      }
      switch (event.key) {
        case ' ':
          togglePlay();
          break;
        case 'ArrowLeft':
          goTo(index - 1);
          break;
        case 'ArrowRight':
          goTo(index + 1);
          break;
        case 'Home':
          goTo(0);
          break;
        case 'End':
          goTo(positions.length - 1);
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loaded, togglePlay, goTo, index, positions]);

  const current = positions[index];

  // El mapa solo se mueve al cambiar de punto o al activar el seguimiento.
  useEffect(() => {
    if (loaded && follow && current) {
      map.easeTo({
        center: [current.longitude, current.latitude],
        zoom: Math.max(map.getZoom(), FOLLOW_ZOOM),
        offset: desktop ? [PANEL_SPACE / 2, 0] : [0, 0],
        duration: playing ? Math.min(300, POINT_INTERVAL / rate) : 0,
      });
    }
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [loaded, follow, current, desktop]);

  const getPadding = useCallback(
    (width, height) => {
      const margin = Math.min(width, height) * 0.1;
      const left = desktop ? PANEL_SPACE : 0;
      return { top: margin, bottom: margin, right: margin, left: left + margin };
    },
    [desktop],
  );

  const onPointClick = useCallback(
    (_, index) => {
      setIndex(index);
    },
    [setIndex],
  );

  const onMarkerClick = useCallback(
    (positionId) => {
      setShowCard(!!positionId);
    },
    [setShowCard],
  );

  const onShow = useCatch(async ({ deviceIds, from, to }) => {
    if (disableReports) {
      return;
    }
    const deviceId = deviceIds.find(() => true);
    setLoading(true);
    setSelectedDeviceId(deviceId);
    const query = new URLSearchParams({ deviceId, from, to });
    try {
      const response = await fetchOrThrow(`/api/positions?${query.toString()}`);
      setPlaying(false);
      setIndex(0);
      const positions = await response.json();
      setPositions(positions);
      if (!positions.length) {
        throw Error(t('sharedNoData'));
      }
    } finally {
      setLoading(false);
    }
  });

  const handleDownload = () => {
    const query = new URLSearchParams({ deviceId: selectedDeviceId, from, to });
    window.location.assign(`/api/positions/kml?${query.toString()}`);
  };

  return (
    <div className={classes.root}>
      <div className={classes.map}>
        <MapView>
          <MapOverlay />
          <MapGeofence />
          <MapRoutePath positions={positions} color={lineColor} progress={index} />
          <MapRoutePoints
            positions={positions}
            onClick={onPointClick}
            showSpeedControl={!lineColor}
            color={lineColor}
            progress={index}
          />
          <MapRouteStops positions={stops} />
          {current && (
            <MapPositions
              positions={[current]}
              onMarkerClick={onMarkerClick}
              titleField="fixTime"
            />
          )}
        </MapView>
        <MapScale />
        <MapCamera positions={positions} getPadding={getPadding} />
      </div>
      <div className={classes.sidebar}>
        <Paper elevation={3} square className={classes.header}>
          <Toolbar>
            <IconButton edge="start" sx={{ mr: 2 }} onClick={() => navigate(-1)}>
              <BackIcon />
            </IconButton>
            <Typography variant="h6" className={classes.title}>
              {t('reportReplay')}
            </Typography>
            {loaded && (
              <>
                <IconButton onClick={handleDownload}>
                  <DownloadIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  onClick={() => updateReportParams(searchParams, setSearchParams, 'ignore', [])}
                >
                  <TuneIcon />
                </IconButton>
              </>
            )}
          </Toolbar>
        </Paper>
        <Paper
          className={cx(classes.content, loaded && classes.player)}
          square={desktop || !loaded}
        >
          {loaded && (
            <ReplayPlayer
              positions={positions}
              index={index}
              onIndex={goTo}
              playing={playing}
              onToggle={togglePlay}
              rate={rate}
              onRate={setRate}
              follow={follow}
              onFollow={setFollow}
              skipStops={skipStops}
              onSkipStops={setSkipStops}
              color={lineColor}
              onColor={setLineColor}
            />
          )}
          <div style={{ display: loaded ? 'none' : 'block' }}>
            <ReportFilter onShow={onShow} deviceType="single" loading={loading} vertical />
          </div>
        </Paper>
      </div>
      {showCard && index < positions.length && (
        <StatusCard
          deviceId={selectedDeviceId}
          position={positions[index]}
          onClose={() => setShowCard(false)}
          disableActions
        />
      )}
    </div>
  );
};

export default ReplayPage;

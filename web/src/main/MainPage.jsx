import { useState, useCallback, useEffect } from 'react';
import { IconButton, Paper, Tooltip } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useDispatch, useSelector } from 'react-redux';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import DeviceList from './DeviceList';
import MainNavigation from './MainNavigation';
import StatusCard from '../common/components/StatusCard';
import { devicesActions } from '../store';
import usePersistedState from '../common/util/usePersistedState';
import EventsDrawer from './EventsDrawer';
import useFilter from './useFilter';
import MainToolbar from './MainToolbar';
import MainMap from './MainMap';
import { useAttributePreference } from '../common/util/preferences';
import useGroupDescendants from '../groups/useGroupDescendants';

const useStyles = makeStyles()((theme, { navigationWidth, sidebarLeft, sidebarOpen }) => ({
  root: {
    height: '100%',
    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.background.default : '#6bd2df',
  },
  navigation: {
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 6,
    [theme.breakpoints.down('md')]: {
      display: 'none',
    },
  },
  navigationToggle: {
    position: 'fixed',
    left: navigationWidth - 17,
    top: 12,
    zIndex: 7,
    width: 34,
    height: 34,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.common.white,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.16)',
    '&:hover': {
      backgroundColor: theme.palette.common.white,
      boxShadow: '0 12px 28px rgba(15, 23, 42, 0.22)',
    },
    [theme.breakpoints.down('md')]: {
      display: 'none',
    },
  },
  sidebar: {
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    [theme.breakpoints.up('md')]: {
      position: 'fixed',
      left: sidebarLeft,
      top: 44,
      width: 288,
      height: `calc(100% - ${theme.spacing(11)})`,
      maxHeight: 640,
      zIndex: 5,
      display: sidebarOpen ? 'flex' : 'none',
    },
    [theme.breakpoints.down('md')]: {
      height: '100%',
      width: '100%',
    },
  },
  header:  {
    pointerEvents: 'auto',
    zIndex: 6,
    borderRadius: '8px 8px 0 0',
    boxShadow: 'none',
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  middle:  { flex: 1, display: 'grid', minHeight: 0 },
  contentMap:  { pointerEvents: 'auto', gridArea: '1 / 1' },
  contentList: {
    pointerEvents: 'auto',
    gridArea: '1 / 1',
    zIndex: 4,
    display: 'flex',
    minHeight: 0,
    borderRadius: '0 0 8px 8px',
    overflow: 'hidden',
    boxShadow: 'none',
  },
  panel: {
    [theme.breakpoints.up('md')]: {
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: '0 18px 50px rgba(15, 23, 42, 0.18)',
      backgroundColor: theme.palette.background.paper,
    },
  },
}));

const MainPage = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const mapOnSelect = useAttributePreference('mapOnSelect', true);

  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const positions = useSelector((state) => state.session.positions);

  const [filteredPositions, setFilteredPositions] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);

  const selectedPosition = filteredPositions.find(
    (position) => selectedDeviceId && position.deviceId === selectedDeviceId,
  );

  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = usePersistedState('filter', { statuses: [], groups: [] });
  const [filterSort, setFilterSort] = usePersistedState('filterSort', '');
  const [filterMap, setFilterMap] = usePersistedState('filterMap', false);
  const [navigationCollapsed, setNavigationCollapsed] = usePersistedState(
    'mainNavigationCollapsed',
    false,
  );
  const [devicesOpen, setDevicesOpen] = useState(!desktop);
  const [eventsOpen, setEventsOpen] = useState(false);

  // ── Filtro por árbol de grupos ─────────────────────────────────────────────
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const groupDescendants = useGroupDescendants(selectedGroupId);

  const handleGroupSelect = useCallback((groupId) => {
    setSelectedGroupId(groupId);
  }, []);

  const onEventsClick = useCallback(() => setEventsOpen(true), []);
  const navigationWidth = desktop ? (navigationCollapsed ? 72 : 224) : 0;
  const sidebarLeft = navigationWidth + 14;
  const desktopPadding = desktop ? navigationWidth + (devicesOpen ? 324 : 24) : undefined;
  const { classes } = useStyles({ navigationWidth, sidebarLeft, sidebarOpen: devicesOpen });

  useEffect(() => {
    if (!desktop && mapOnSelect && selectedDeviceId) {
      setDevicesOpen(false);
    }
  }, [desktop, mapOnSelect, selectedDeviceId]);

  useEffect(() => {
    if (!desktop && !selectedDeviceId) {
      setDevicesOpen(true);
    }
  }, [desktop, selectedDeviceId]);

  useFilter(
    keyword,
    filter,
    filterSort,
    filterMap,
    positions,
    setFilteredDevices,
    setFilteredPositions,
  );

  // ── Aplicar filtro de grupo sobre los dispositivos ya filtrados ────────────
  const groupFilteredDevices = selectedGroupId
    ? filteredDevices.filter((device) => groupDescendants.has(device.groupId))
    : filteredDevices;

  const groupFilteredPositions = selectedGroupId
    ? filteredPositions.filter((pos) => {
        const device = groupFilteredDevices.find((d) => d.id === pos.deviceId);
        return Boolean(device);
      })
    : filteredPositions;

  return (
    <div className={classes.root}>
      {desktop && (
        <MainMap
          filteredPositions={groupFilteredPositions}
          selectedPosition={selectedPosition}
          onEventsClick={onEventsClick}
          desktopPadding={desktopPadding}
        />
      )}
      {desktop && (
        <div className={classes.navigation}>
          <MainNavigation
            collapsed={navigationCollapsed}
            vehiclesPanelOpen={devicesOpen}
            onVehiclesClick={() => setDevicesOpen(true)}
            onMapClick={() => setDevicesOpen(false)}
          />
        </div>
      )}
      {desktop && (
        <Tooltip title={navigationCollapsed ? 'Expandir menu' : 'Contraer menu'} placement="right">
          <IconButton
            className={classes.navigationToggle}
            onClick={() => setNavigationCollapsed(!navigationCollapsed)}
          >
            {navigationCollapsed ? (
              <KeyboardDoubleArrowRightIcon fontSize="small" />
            ) : (
              <KeyboardDoubleArrowLeftIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      )}
      <div className={classes.sidebar}>
        <div className={classes.panel}>
        <Paper square elevation={3} className={classes.header}>
          <MainToolbar
            filteredDevices={groupFilteredDevices}
            devicesOpen={devicesOpen}
            setDevicesOpen={setDevicesOpen}
            keyword={keyword}
            setKeyword={setKeyword}
            filter={filter}
            setFilter={setFilter}
            filterSort={filterSort}
            setFilterSort={setFilterSort}
            filterMap={filterMap}
            setFilterMap={setFilterMap}
            selectedGroupId={selectedGroupId}
            onGroupSelect={handleGroupSelect}
          />
        </Paper>
        <div className={classes.middle}>
          {!desktop && (
            <div className={classes.contentMap}>
              <MainMap
                filteredPositions={groupFilteredPositions}
                selectedPosition={selectedPosition}
                onEventsClick={onEventsClick}
              />
            </div>
          )}
          <Paper
            square
            className={classes.contentList}
            style={devicesOpen ? {} : { visibility: 'hidden' }}
          >
            <DeviceList devices={groupFilteredDevices} />
          </Paper>
        </div>
        </div>
      </div>
      <EventsDrawer open={eventsOpen} onClose={() => setEventsOpen(false)} />
      {selectedDeviceId && (
        <StatusCard
          deviceId={selectedDeviceId}
          position={selectedPosition}
          onClose={() => dispatch(devicesActions.selectId(null))}
          desktopPadding={desktopPadding || theme.dimensions.drawerWidthDesktop}
        />
      )}
    </div>
  );
};

export default MainPage;

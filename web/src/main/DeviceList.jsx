import { useEffect, useReducer, memo } from 'react';
import { useDispatch } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { makeStyles } from 'tss-react/mui';
import { List } from 'react-window';
import { devicesActions } from '../store';
import { useEffectAsync } from '../reactHelper';
import DeviceRow from './DeviceRow';
import fetchOrThrow from '../common/util/fetchOrThrow';

const useStyles = makeStyles()((theme) => ({
  list: {
    height: '100%',
    direction: theme.direction,
    backgroundColor: theme.palette.background.default,
    [theme.breakpoints.up('md')]: {
      backgroundColor: theme.palette.background.paper,
    },
  },
  listInner: {
    position: 'relative',
    margin: theme.spacing(1.5, 0),
  },
}));

// ── DeviceRow memoizado ───────────────────────────────────────────────────────
// Evita re-renders cuando cambia otro dispositivo en el store.
// Solo re-renderiza si cambian los props que realmente afectan esta fila.
const MemoDeviceRow = memo(DeviceRow, (prev, next) => {
  const prevDevice = prev.devices[prev.index];
  const nextDevice = next.devices[next.index];
  return (
    prev.index === next.index &&
    prev.style === next.style &&
    prevDevice?.id === nextDevice?.id &&
    prevDevice?.status === nextDevice?.status &&
    prevDevice?.lastUpdate === nextDevice?.lastUpdate &&
    prevDevice?.name === nextDevice?.name
  );
});

MemoDeviceRow.displayName = 'MemoDeviceRow';

const DeviceList = ({ devices }) => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  // Refresca el tiempo relativo ("hace 2 min") cada 60 segundos
  const [, refreshTime] = useReducer((value) => value + 1, 0);

  useEffect(() => {
    const interval = setInterval(refreshTime, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffectAsync(async () => {
    const response = await fetchOrThrow('/api/devices');
    dispatch(devicesActions.refresh(await response.json()));
  }, []);

  return (
    <List
      className={classes.list}
      rowComponent={MemoDeviceRow}
      rowCount={devices.length}
      rowHeight={desktop ? 64 : 72}
      rowProps={{ devices }}
      overscanCount={5}
    />
  );
};

export default DeviceList;

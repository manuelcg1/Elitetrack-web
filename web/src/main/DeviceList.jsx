import { useEffect, useState, memo } from 'react';
import { useDispatch } from 'react-redux';
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
    backgroundColor: theme.palette.background.paper,
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

  // Refresca el tiempo relativo ("hace 2 min") cada 60 segundos
  const [, setTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setTime(Date.now()), 60000);
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
      rowHeight={64}
      rowProps={{ devices }}
      overscanCount={5}
    />
  );
};

export default DeviceList;

import { Checkbox, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useDispatch, useSelector } from 'react-redux';
import { deviceVisibilityActions } from '../store';

const useStyles = makeStyles()((theme) => ({
  root: {
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1.25),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  title: {
    minWidth: 0,
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 1.2,
  },
}));

const DeviceVisibilityControl = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const devices = useSelector((state) => state.devices.items);
  const visibleById = useSelector((state) => state.deviceVisibility.byId);
  const deviceIds = Object.keys(devices);
  const visibleCount = deviceIds.reduce(
    (count, deviceId) => count + (visibleById[deviceId] === true ? 1 : 0),
    0,
  );
  const allVisible = deviceIds.length > 0 && visibleCount === deviceIds.length;
  const partiallyVisible = visibleCount > 0 && !allVisible;

  return (
    <div className={classes.root}>
      <Typography variant="body2" className={classes.title}>
        Mostrar todos los dispositivos
      </Typography>
      <Checkbox
        checked={allVisible}
        indeterminate={partiallyVisible}
        disabled={!deviceIds.length}
        color="success"
        inputProps={{ 'aria-label': 'Mostrar todos los dispositivos en el mapa' }}
        onChange={() =>
          dispatch(deviceVisibilityActions.setAll({ deviceIds, visible: !allVisible }))
        }
      />
    </div>
  );
};

export default DeviceVisibilityControl;

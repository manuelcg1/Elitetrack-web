import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import {
  IconButton,
  Tooltip,
  Avatar,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Typography,
} from '@mui/material';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import Battery60Icon from '@mui/icons-material/Battery60';
import BatteryCharging60Icon from '@mui/icons-material/BatteryCharging60';
import Battery20Icon from '@mui/icons-material/Battery20';
import BatteryCharging20Icon from '@mui/icons-material/BatteryCharging20';
import ErrorIcon from '@mui/icons-material/Error';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { devicesActions } from '../store';
import {
  formatAlarm,
  formatBoolean,
  formatPercentage,
  formatStatus,
  getStatusColor,
} from '../common/util/formatter';
import { useTranslation } from '../common/components/LocalizationProvider';
import { mapIconKey, mapIcons } from '../map/core/preloadImages';
import { useAdministrator } from '../common/util/permissions';
import EngineIcon from '../resources/images/data/engine.svg?react';
import { useAttributePreference } from '../common/util/preferences';
import GeofencesValue from '../common/components/GeofencesValue';
import DriverValue from '../common/components/DriverValue';
import MotionBar from './components/MotionBar';

dayjs.extend(relativeTime);

const useStyles = makeStyles()((theme) => ({
  icon: {
    width: '25px',
    height: '25px',
    filter: 'brightness(0) invert(1)',
  },
  batteryText: {
    fontSize: '0.75rem',
    fontWeight: 'normal',
    lineHeight: '0.875rem',
  },
  success: {
    color: theme.palette.success.main,
  },
  warning: {
    color: theme.palette.warning.main,
  },
  error: {
    color: theme.palette.error.main,
  },
  neutral: {
    color: theme.palette.neutral.main,
  },
  selected: {
    backgroundColor: theme.palette.success.main + '12',
  },
  row: {
    height: 'calc(100% - 6px)',
    margin: theme.spacing(0.375, 1),
    padding: theme.spacing(0.5, 1.25),
    gap: theme.spacing(1),
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    [theme.breakpoints.up('md')]: {
      height: '100%',
      margin: 0,
      borderRadius: 0,
      border: 0,
      borderBottom: `1px solid ${theme.palette.divider}`,
      boxShadow: 'none',
    },
  },
  avatar: {
    width: 38,
    height: 38,
    backgroundColor: theme.palette.action.disabledBackground,
    [theme.breakpoints.up('md')]: {
      width: 34,
      height: 34,
    },
  },
  selectedAvatar: {
    backgroundColor: theme.palette.success.main,
  },
  primaryLine: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minWidth: 0,
  },
  primaryValue: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  secondaryLine: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    width: '100%',
    minWidth: 0,
  },
  secondaryValue: {
    flex: '1 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  ignitionIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 20,
    height: 20,
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    flexShrink: 0,
    marginLeft: 'auto',
    maxWidth: '50%',
    boxSizing: 'border-box',
    padding: theme.spacing(0.125, 0.625),
    border: '1px solid currentColor',
    borderRadius: 999,
    fontSize: '0.68rem',
    fontWeight: 600,
    lineHeight: 1.35,
    whiteSpace: 'nowrap',
    '&::before': {
      content: '""',
      width: 5,
      height: 5,
      flexShrink: 0,
      borderRadius: '50%',
      backgroundColor: 'currentColor',
    },
  },
  statusText: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}));

const DeviceRow = ({ devices, index, style }) => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const t = useTranslation();

  const admin = useAdministrator();
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);

  const item = devices[index];
  const position = useSelector((state) => state.session.positions[item.id]);

  const devicePrimary = useAttributePreference('devicePrimary', 'name');
  const deviceSecondary = useAttributePreference('deviceSecondary', '');

  const resolveFieldValue = (field) => {
    if (field === 'geofenceIds') {
      const geofenceIds = position?.geofenceIds;
      return geofenceIds?.length ? <GeofencesValue geofenceIds={geofenceIds} /> : null;
    }
    if (field === 'driverUniqueId') {
      const driverUniqueId = position?.attributes?.driverUniqueId;
      return driverUniqueId ? <DriverValue driverUniqueId={driverUniqueId} /> : null;
    }
    if (field === 'motion') {
      return <MotionBar deviceId={item.id} />;
    }
    return item[field];
  };

  const primaryValue = resolveFieldValue(devicePrimary);
  const secondaryValue = resolveFieldValue(deviceSecondary);

  const status =
    item.status === 'online' || !item.lastUpdate
      ? formatStatus(item.status, t)
      : dayjs(item.lastUpdate).fromNow();

  const primaryText = () => (
    <span className={classes.primaryLine}>
      <span className={classes.primaryValue}>{primaryValue}</span>
      <span
        className={`${classes.statusBadge} ${classes[getStatusColor(item.status)]}`}
        title={status}
      >
        <span className={classes.statusText}>{status}</span>
      </span>
    </span>
  );

  const secondaryText = () => (
    <span className={classes.secondaryLine}>
      {secondaryValue && <span className={classes.secondaryValue}>{secondaryValue}</span>}
      {position?.attributes?.hasOwnProperty('ignition') && (
        <Tooltip
          title={`${t('positionIgnition')}: ${formatBoolean(position.attributes.ignition, t)}`}
        >
          <span className={classes.ignitionIndicator}>
            <EngineIcon
              width={17}
              height={17}
              className={position.attributes.ignition ? classes.success : classes.neutral}
            />
          </span>
        </Tooltip>
      )}
    </span>
  );

  return (
    <div style={style}>
      <ListItemButton
        key={item.id}
        onClick={() => dispatch(devicesActions.selectId(item.id))}
        disabled={!admin && item.disabled}
        selected={selectedDeviceId === item.id}
        className={`${classes.row} ${selectedDeviceId === item.id ? classes.selected : ''}`}
      >
        <ListItemAvatar sx={{ minWidth: { xs: 48, md: 48 } }}>
          <Avatar
            className={`${classes.avatar} ${selectedDeviceId === item.id ? classes.selectedAvatar : ''}`}
          >
            <img className={classes.icon} src={mapIcons[mapIconKey(item.category)]} alt="" />
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={primaryText()}
          secondary={
            secondaryValue || position?.attributes?.hasOwnProperty('ignition')
              ? secondaryText()
              : null
          }
          slots={{
            primary: Typography,
            secondary: Typography,
          }}
          slotProps={{
            primary: {
              noWrap: true,
              fontWeight: 700,
              fontSize: '0.92rem',
              lineHeight: 1.2,
            },
            secondary: {
              component: 'div',
              fontSize: '0.78rem',
              lineHeight: 1.4,
              overflow: 'visible',
            },
          }}
          sx={{ minWidth: 0, mr: 0.5 }}
        />
        {position && (
          <>
            {position.attributes.hasOwnProperty('alarm') && (
              <Tooltip title={`${t('eventAlarm')}: ${formatAlarm(position.attributes.alarm, t)}`}>
                <IconButton size="small">
                  <ErrorIcon fontSize="small" className={classes.error} />
                </IconButton>
              </Tooltip>
            )}
            {position.attributes.hasOwnProperty('batteryLevel') && (
              <Tooltip
                title={`${t('positionBatteryLevel')}: ${formatPercentage(position.attributes.batteryLevel)}`}
              >
                <IconButton size="small">
                  {(position.attributes.batteryLevel > 70 &&
                    (position.attributes.charge ? (
                      <BatteryChargingFullIcon fontSize="small" className={classes.success} />
                    ) : (
                      <BatteryFullIcon fontSize="small" className={classes.success} />
                    ))) ||
                    (position.attributes.batteryLevel > 30 &&
                      (position.attributes.charge ? (
                        <BatteryCharging60Icon fontSize="small" className={classes.warning} />
                      ) : (
                        <Battery60Icon fontSize="small" className={classes.warning} />
                      ))) ||
                    (position.attributes.charge ? (
                      <BatteryCharging20Icon fontSize="small" className={classes.error} />
                    ) : (
                      <Battery20Icon fontSize="small" className={classes.error} />
                    ))}
                </IconButton>
              </Tooltip>
            )}
          </>
        )}
      </ListItemButton>
    </div>
  );
};

export default DeviceRow;

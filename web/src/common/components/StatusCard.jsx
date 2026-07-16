import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Rnd } from 'react-rnd';
import {
  Card,
  CardContent,
  Typography,
  CardActions,
  IconButton,
  Menu,
  MenuItem,
  Link,
  Tooltip,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import CloseIcon from '@mui/icons-material/Close';
import RouteIcon from '@mui/icons-material/Route';
import SendIcon from '@mui/icons-material/Send';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PendingIcon from '@mui/icons-material/Pending';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import StraightenOutlinedIcon from '@mui/icons-material/StraightenOutlined';
import FenceOutlinedIcon from '@mui/icons-material/FenceOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { useTranslation } from './LocalizationProvider';
import RemoveDialog from './RemoveDialog';
import PositionValue from './PositionValue';
import { useDeviceReadonly, useRestriction } from '../util/permissions';
import usePositionAttributes from '../attributes/usePositionAttributes';
import { devicesActions } from '../../store';
import { useCatch, useCatchCallback } from '../../reactHelper';
import { useAttributePreference } from '../util/preferences';
import fetchOrThrow from '../util/fetchOrThrow';
import { mapIcons, mapIconKey } from '../../map/core/preloadImages';

const useStyles = makeStyles()((theme, { desktopPadding }) => ({
  card: {
    pointerEvents: 'auto',
    width: 320,
    maxWidth: 'calc(100vw - 32px)',
    borderRadius: 16,
    overflow: 'hidden',
    border: `1px solid ${theme.palette.divider}`,
    boxShadow:
      theme.palette.mode === 'dark'
        ? '0 18px 48px rgba(0, 0, 0, 0.45)'
        : '0 18px 48px rgba(33, 37, 41, 0.18)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing(1.5, 1.75),
    borderBottom: `1px solid ${theme.palette.divider}`,
    cursor: 'move',
  },
  identity: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    minWidth: 0,
  },
  avatar: {
    width: 48,
    height: 48,
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    position: 'relative',
    borderRadius: '50%',
    background: `linear-gradient(145deg, ${theme.palette.primary.main}18, ${theme.palette.primary.main}40)`,
    border: `3px solid ${theme.palette.background.paper}`,
    boxShadow: `0 0 0 2px ${theme.palette.primary.main}35`,
  },
  avatarImage: {
    width: '72%',
    height: '72%',
    objectFit: 'contain',
  },
  avatarStatus: {
    position: 'absolute',
    right: -2,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: `3px solid ${theme.palette.background.paper}`,
    backgroundColor: ({ status }) =>
      ({
        online: theme.palette.success.main,
        offline: theme.palette.error.main,
        unknown: theme.palette.text.secondary,
      })[status] || theme.palette.text.disabled,
  },
  title: {
    fontWeight: 700,
    lineHeight: 1.25,
    fontSize: '0.95rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  status: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 68,
    marginTop: theme.spacing(0.4),
    padding: theme.spacing(0.25, 1),
    borderRadius: 999,
    border: '1px solid currentColor',
    '& .MuiTypography-root': {
      fontSize: '0.68rem',
      fontWeight: 600,
      lineHeight: 1.2,
      textAlign: 'center',
      whiteSpace: 'nowrap',
      color: 'inherit !important',
    },
  },
  statusOnline: {
    color: `${theme.palette.success.dark} !important`,
    borderColor: `${theme.palette.success.main} !important`,
    backgroundColor: `${theme.palette.success.main}14 !important`,
  },
  statusOffline: {
    color: `${theme.palette.error.main} !important`,
    borderColor: `${theme.palette.error.main} !important`,
    backgroundColor: `${theme.palette.error.main}0D !important`,
  },
  statusUnknown: {
    color: `${theme.palette.text.secondary} !important`,
    borderColor: `${theme.palette.text.secondary} !important`,
    backgroundColor: `${theme.palette.action.hover} !important`,
  },
  closeButton: {
    color: theme.palette.text.secondary,
    '&:hover': {
      color: theme.palette.text.primary,
      backgroundColor: theme.palette.action.hover,
    },
  },
  content: {
    padding: theme.spacing(1, 1.75, 1.25),
    maxHeight: '34vh',
    overflow: 'auto',
    '&:last-child': {
      paddingBottom: theme.spacing(1.5),
    },
  },
  informationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(0),
    borderTop: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' },
  },
  informationItem: {
    display: 'flex',
    gap: theme.spacing(0.75),
    minWidth: 0,
    padding: theme.spacing(1),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  featuredItem: {
    gridColumn: '1 / -1',
    padding: theme.spacing(1, 0, 1.25),
  },
  informationText: {
    minWidth: 0,
    flex: 1,
  },
  label: {
    color: theme.palette.text.secondary,
    fontWeight: 500,
    fontSize: '0.72rem',
    lineHeight: 1.25,
  },
  labelContent: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
  },
  infoIcon: {
    width: 18,
    height: 18,
    flexShrink: 0,
    marginTop: 2,
    color: theme.palette.primary.main,
  },
  value: {
    color: theme.palette.text.primary,
    fontWeight: 700,
    fontSize: '0.78rem',
    marginTop: theme.spacing(0.35),
    lineHeight: 1.35,
    overflowWrap: 'anywhere',
  },
  detailsLink: {
    display: 'inline-flex',
    marginTop: theme.spacing(1.1),
    fontSize: '0.75rem',
    fontWeight: 600,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  actions: {
    justifyContent: 'space-between',
    padding: theme.spacing(0.5, 1),
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.025)' : 'rgba(33,37,41,0.018)',
  },
  actionButton: {
    color: theme.palette.text.secondary,
    transition: theme.transitions.create(['color', 'background-color', 'transform'], {
      duration: theme.transitions.duration.shortest,
    }),
    '&:hover': {
      color: theme.palette.primary.main,
      backgroundColor: theme.palette.action.hover,
      transform: 'translateY(-1px)',
    },
  },
  actionItem: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    color: theme.palette.text.secondary,
    '& + &': { borderLeft: `1px solid ${theme.palette.divider}` },
  },
  actionLabel: {
    maxWidth: '100%',
    fontSize: '0.6rem',
    lineHeight: 1.2,
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  removeButton: {
    '&:hover': {
      color: theme.palette.error.main,
      backgroundColor: `${theme.palette.error.main}12`,
    },
  },
  root: {
    pointerEvents: 'none',
    position: 'fixed',
    zIndex: 5,
    left: '50%',
    [theme.breakpoints.up('md')]: {
      left: `calc(50% + ${desktopPadding} / 2)`,
      bottom: theme.spacing(3),
    },
    [theme.breakpoints.down('md')]: {
      left: '50%',
      bottom: `calc(${theme.spacing(3)} + ${theme.dimensions.bottomBarHeight}px)`,
    },
    transform: 'translateX(-50%)',
  },
}));

const positionIcons = {
  address: LocationOnOutlinedIcon,
  latitude: LocationOnOutlinedIcon,
  longitude: LocationOnOutlinedIcon,
  speed: SpeedOutlinedIcon,
  obdSpeed: SpeedOutlinedIcon,
  speedLimit: SpeedOutlinedIcon,
  deviceTime: ScheduleOutlinedIcon,
  fixTime: ScheduleOutlinedIcon,
  serverTime: ScheduleOutlinedIcon,
  hours: ScheduleOutlinedIcon,
  drivingTime: ScheduleOutlinedIcon,
  distance: StraightenOutlinedIcon,
  totalDistance: StraightenOutlinedIcon,
  odometer: StraightenOutlinedIcon,
  tripOdometer: StraightenOutlinedIcon,
  serviceOdometer: StraightenOutlinedIcon,
  geofence: FenceOutlinedIcon,
  geofenceIds: FenceOutlinedIcon,
};

const StatusRow = ({ name, content, propertyKey, classes }) => {
  const PropertyIcon = positionIcons[propertyKey] || InfoOutlinedIcon;
  const featured = ['address', 'geofence', 'geofenceIds'].includes(propertyKey);

  return (
    <div className={`${classes.informationItem} ${featured ? classes.featuredItem : ''}`}>
      <PropertyIcon className={classes.infoIcon} />
      <div className={classes.informationText}>
        <div className={classes.labelContent}>
          <Typography variant="body2" className={classes.label}>
            {name}
          </Typography>
        </div>
        <Typography variant="body2" className={classes.value}>
          {content}
        </Typography>
      </div>
    </div>
  );
};

const StatusCard = ({ deviceId, position, onClose, disableActions, desktopPadding = 0 }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const t = useTranslation();

  const readonly = useRestriction('readonly');
  const disableReports = useRestriction('disableReports');
  const deviceReadonly = useDeviceReadonly();

  const shareDisabled = useSelector((state) => state.session.server.attributes.disableShare);
  const user = useSelector((state) => state.session.user);
  const device = useSelector((state) => state.devices.items[deviceId]);
  const { classes, cx } = useStyles({ desktopPadding, status: device?.status });

  const deviceIconKey = mapIconKey(device?.category);
  const deviceIcon = mapIcons[deviceIconKey === 'default' ? 'car' : deviceIconKey] || mapIcons.car;

  const positionAttributes = usePositionAttributes(t);
  const positionItems = useAttributePreference(
    'positionItems',
    'fixTime,address,speed,totalDistance',
  );

  const navigationAppLink = useAttributePreference('navigationAppLink');
  const navigationAppTitle = useAttributePreference('navigationAppTitle');

  const [anchorEl, setAnchorEl] = useState(null);

  const [removing, setRemoving] = useState(false);

  const statusLabel = device?.status
    ? t(`deviceStatus${device.status.charAt(0).toUpperCase()}${device.status.slice(1)}`)
    : t('deviceStatusUnknown');
  const statusClass =
    {
      online: classes.statusOnline,
      offline: classes.statusOffline,
      unknown: classes.statusUnknown,
    }[device?.status] || classes.statusUnknown;

  const handleRemove = useCatch(async (removed) => {
    if (removed) {
      const response = await fetchOrThrow('/api/devices');
      dispatch(devicesActions.refresh(await response.json()));
    }
    setRemoving(false);
  });

  const handleGeofence = useCatchCallback(async () => {
    const newItem = {
      name: t('sharedGeofence'),
      area: `CIRCLE (${position.latitude} ${position.longitude}, 50)`,
    };
    const response = await fetchOrThrow('/api/geofences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    });
    const item = await response.json();
    await fetchOrThrow('/api/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: position.deviceId, geofenceId: item.id }),
    });
    navigate(`/settings/geofence/${item.id}`);
  }, [navigate, position]);

  return (
    <>
      <div className={classes.root}>
        {device && (
          <Rnd
            default={{ x: 0, y: 0, width: 'auto', height: 'auto' }}
            enableResizing={false}
            dragHandleClassName="draggable-header"
            style={{ position: 'relative' }}
          >
            <Card elevation={3} className={classes.card}>
              <div className={`${classes.header} draggable-header`}>
                <div className={classes.identity}>
                  <div className={classes.avatar}>
                    <img className={classes.avatarImage} src={deviceIcon} alt="" />
                    <span className={classes.avatarStatus} />
                  </div>
                  <div>
                    <Typography variant="subtitle1" className={classes.title}>
                      {device.name}
                    </Typography>
                    <div className={cx(classes.status, statusClass)}>
                      <Typography variant="caption">{statusLabel}</Typography>
                    </div>
                  </div>
                </div>
                <IconButton
                  className={classes.closeButton}
                  size="small"
                  onClick={onClose}
                  onTouchStart={onClose}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </div>
              {position && (
                <CardContent className={classes.content}>
                  <div className={classes.informationGrid}>
                    {positionItems
                      .split(',')
                      .filter(
                        (key) =>
                          position.hasOwnProperty(key) || position.attributes.hasOwnProperty(key),
                      )
                      .map((key) => (
                        <StatusRow
                          key={key}
                          name={positionAttributes[key]?.name || key}
                          propertyKey={key}
                          classes={classes}
                          content={
                            <PositionValue
                              position={position}
                              property={position.hasOwnProperty(key) ? key : null}
                              attribute={position.hasOwnProperty(key) ? null : key}
                            />
                          }
                        />
                      ))}
                  </div>
                  <Typography variant="body2">
                    <Link
                      className={classes.detailsLink}
                      component={RouterLink}
                      to={`/position/${position.id}`}
                    >
                      {t('sharedShowDetails')}
                    </Link>
                  </Typography>
                </CardContent>
              )}
              <CardActions className={classes.actions} disableSpacing>
                <div className={classes.actionItem}>
                  <Tooltip title={t('sharedExtra')}>
                    <IconButton
                      className={classes.actionButton}
                      onClick={(e) => setAnchorEl(e.currentTarget)}
                      disabled={!position}
                    >
                      <PendingIcon />
                    </IconButton>
                  </Tooltip>
                  <Typography className={classes.actionLabel}>{t('sharedExtra')}</Typography>
                </div>
                <div className={classes.actionItem}>
                  <Tooltip title={t('reportReplay')}>
                    <IconButton
                      className={classes.actionButton}
                      onClick={() => navigate(`/replay?deviceId=${deviceId}`)}
                      disabled={disableActions || disableReports || !position}
                    >
                      <RouteIcon />
                    </IconButton>
                  </Tooltip>
                  <Typography className={classes.actionLabel}>{t('reportReplay')}</Typography>
                </div>
                <div className={classes.actionItem}>
                  <Tooltip title={t('commandTitle')}>
                    <IconButton
                      className={classes.actionButton}
                      onClick={() => navigate(`/settings/device/${deviceId}/command`)}
                      disabled={disableActions}
                    >
                      <SendIcon />
                    </IconButton>
                  </Tooltip>
                  <Typography className={classes.actionLabel}>{t('commandTitle')}</Typography>
                </div>
                <div className={classes.actionItem}>
                  <Tooltip title={t('sharedEdit')}>
                    <IconButton
                      className={classes.actionButton}
                      onClick={() => navigate(`/settings/device/${deviceId}`)}
                      disabled={disableActions || deviceReadonly}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Typography className={classes.actionLabel}>{t('sharedEdit')}</Typography>
                </div>
                <div className={classes.actionItem}>
                  <Tooltip title={t('sharedRemove')}>
                    <IconButton
                      className={cx(classes.actionButton, classes.removeButton)}
                      onClick={() => setRemoving(true)}
                      disabled={disableActions || deviceReadonly}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                  <Typography className={classes.actionLabel}>{t('sharedRemove')}</Typography>
                </div>
              </CardActions>
            </Card>
          </Rnd>
        )}
      </div>
      {position && (
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          {!readonly && <MenuItem onClick={handleGeofence}>{t('sharedCreateGeofence')}</MenuItem>}
          <MenuItem
            component="a"
            target="_blank"
            href={`https://www.google.com/maps/search/?api=1&query=${position.latitude}%2C${position.longitude}`}
          >
            {t('linkGoogleMaps')}
          </MenuItem>
          <MenuItem
            component="a"
            target="_blank"
            href={`http://maps.apple.com/?ll=${position.latitude},${position.longitude}`}
          >
            {t('linkAppleMaps')}
          </MenuItem>
          <MenuItem
            component="a"
            target="_blank"
            href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${position.latitude}%2C${position.longitude}&heading=${position.course}`}
          >
            {t('linkStreetView')}
          </MenuItem>
          {navigationAppTitle && (
            <MenuItem
              component="a"
              target="_blank"
              href={navigationAppLink
                .replace('{latitude}', position.latitude)
                .replace('{longitude}', position.longitude)}
            >
              {navigationAppTitle}
            </MenuItem>
          )}
          {!shareDisabled && !user.temporary && (
            <MenuItem onClick={() => navigate(`/settings/device/${deviceId}/share`)}>
              <Typography color="secondary">{t('sharedShare')}</Typography>
            </MenuItem>
          )}
        </Menu>
      )}
      <RemoveDialog
        open={removing}
        endpoint="devices"
        itemId={deviceId}
        onResult={(removed) => handleRemove(removed)}
      />
    </>
  );
};

export default StatusCard;

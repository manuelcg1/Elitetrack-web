import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  ButtonBase,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DescriptionIcon from '@mui/icons-material/Description';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LogoutIcon from '@mui/icons-material/Logout';
import MapIcon from '@mui/icons-material/Map';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import PlaceIcon from '@mui/icons-material/Place';
import SettingsIcon from '@mui/icons-material/Settings';
import WarningIcon from '@mui/icons-material/Warning';
import { sessionActions } from '../store';
import { useColorMode } from '../AppThemeProvider';
import { nativePostMessage } from '../common/components/NativeInterface';
import logoMenuLateral from '../resources/images/logo-menu-lateral.svg';

const useStyles = makeStyles()((theme, { collapsed }) => ({
  root: {
    width: collapsed ? 72 : 224,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.paper,
    borderRight: `1px solid ${theme.palette.divider}`,
    boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
    transition: theme.transitions.create('width', {
      duration: theme.transitions.duration.short,
    }),
  },
  brand: {
    height: 58,
    padding: theme.spacing(0, collapsed ? 1 : 1.5),
    display: 'flex',
    alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'flex-start',
    gap: theme.spacing(1),
  },
  brandLogo: {
    flex: collapsed ? '0 0 auto' : 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'flex-start',
    gap: theme.spacing(1),
  },
  logoMark: {
    width: collapsed ? 44 : 34,
    height: collapsed ? 38 : 34,
    flex: '0 0 auto',
    borderRadius: collapsed ? 0 : 10,
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    backgroundColor: collapsed ? 'transparent' : theme.palette.common.white,
    boxShadow: collapsed ? 'none' : '0 8px 18px rgba(15, 23, 42, 0.12)',
    border: collapsed ? 'none' : `1px solid ${theme.palette.divider}`,
  },
  logoImage: {
    width: collapsed ? 32 : '100%',
    height: collapsed ? 32 : '100%',
    display: 'block',
    objectFit: 'contain',
  },
  brandText: {
    minWidth: 0,
    lineHeight: 1,
  },
  brandTitle: {
    fontSize: 18,
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: 0,
    whiteSpace: 'nowrap',
  },
  brandAccent: {
    color: theme.palette.success.main,
  },
  brandName: {
    color: theme.palette.text.primary,
  },
  brandSubtitle: {
    marginTop: 3,
    display: 'block',
    color: theme.palette.text.secondary,
    fontSize: 9.5,
    lineHeight: 1.1,
    fontWeight: 700,
    letterSpacing: 0,
    whiteSpace: 'nowrap',
  },
  content: {
    padding: theme.spacing(1),
    flex: 1,
    overflow: 'auto',
    alignItems: collapsed ? 'center' : 'stretch',
  },
  item: {
    width: collapsed ? 44 : '100%',
    minWidth: collapsed ? 44 : 0,
    height: 38,
    minHeight: 38,
    borderRadius: 10,
    padding: theme.spacing(0.75, collapsed ? 0 : 1.25),
    display: 'flex',
    alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'space-between',
    color: theme.palette.text.primary,
    transition: theme.transitions.create(['background-color', 'color'], {
      duration: theme.transitions.duration.shortest,
    }),
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  itemSelected: {
    color: theme.palette.success.main,
    backgroundColor: `${theme.palette.success.main}18`,
    fontWeight: 700,
  },
  itemText: {
    minWidth: 0,
    display: collapsed ? 'none' : 'flex',
  },
  footer: {
    borderTop: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1.25),
    display: 'flex',
    flexDirection: 'column',
    alignItems: collapsed ? 'center' : 'stretch',
  },
}));

const MainNavigation = ({
  collapsed,
  vehiclesPanelOpen,
  onVehiclesClick,
  onMapClick,
}) => {
  const { classes, cx } = useStyles({ collapsed });
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { toggleDarkMode } = useColorMode();
  const user = useSelector((state) => state.session.user);

  const logout = async () => {
    await fetch('/api/session', { method: 'DELETE' });
    nativePostMessage('logout');
    dispatch(sessionActions.updateUser(null));
    navigate('/login');
  };

  const selected = (path) => (
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  );

  const item = ({ label, icon, path, selectedPath, active, onClick }) => {
    const button = (
      <ButtonBase
        className={cx(
          classes.item,
          (active ?? selected(selectedPath || path)) && classes.itemSelected,
        )}
        onClick={onClick || (() => navigate(path))}
      >
        <Stack
          direction="row"
          spacing={collapsed ? 0 : 1.25}
          alignItems="center"
          sx={{ minWidth: 0 }}
        >
          {icon}
          <Box className={classes.itemText}>
            <Typography variant="body2" fontWeight="inherit" noWrap>{label}</Typography>
          </Box>
        </Stack>
      </ButtonBase>
    );

    return collapsed ? <Tooltip title={label} placement="right">{button}</Tooltip> : button;
  };

  return (
    <Box className={classes.root}>
      <Box className={classes.brand}>
        <Box className={classes.brandLogo}>
          <Box className={classes.logoMark}>
            <img
              src={logoMenuLateral}
              alt="EliteTrack"
              className={classes.logoImage}
            />
          </Box>
          {!collapsed && (
            <Box className={classes.brandText}>
              <Typography component="div" className={classes.brandTitle}>
                <Box component="span" className={classes.brandAccent}>ELITE</Box>
                <Box component="span" className={classes.brandName}>TRACK</Box>
              </Typography>
              <Typography component="span" className={classes.brandSubtitle}>
                SISTEMA DE RASTREO GPS
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
      <Divider />
      <Stack className={classes.content} spacing={0.5}>
        {item({
          label: 'Vehiculos',
          icon: <DirectionsCarIcon fontSize="small" />,
          path: '/',
          active: vehiclesPanelOpen,
          onClick: () => {
            onVehiclesClick();
            navigate('/');
          },
        })}
        {item({ label: 'Geocercas', icon: <PlaceIcon fontSize="small" />, path: '/geofences' })}
        {item({
          label: 'Mapa',
          icon: <MapIcon fontSize="small" />,
          path: '/',
          active: location.pathname === '/' && !vehiclesPanelOpen,
          onClick: () => {
            onMapClick();
            navigate('/');
          },
        })}
        {item({
          label: 'Reportes',
          icon: <DescriptionIcon fontSize="small" />,
          path: '/reports/combined',
          selectedPath: '/reports',
        })}
        {item({
          label: 'Ajustes',
          icon: <SettingsIcon fontSize="small" />,
          path: '/settings/preferences',
          selectedPath: '/settings',
        })}
        {item({ label: 'Alertas', icon: <WarningIcon fontSize="small" />, path: '/monitoring/alerts' })}
        {item({
          label: 'Monitoreo',
          icon: <NotificationsActiveIcon fontSize="small" />,
          path: '/monitoring/health',
        })}
      </Stack>
      <Box className={classes.footer}>
        <Tooltip title={collapsed ? 'Modo oscuro' : ''} placement="right">
          <ButtonBase className={classes.item} onClick={toggleDarkMode}>
            <Stack direction="row" spacing={collapsed ? 0 : 1.25} alignItems="center">
              <DarkModeIcon fontSize="small" />
              <Box className={classes.itemText}>
                <Typography variant="body2">Modo oscuro</Typography>
              </Box>
            </Stack>
          </ButtonBase>
        </Tooltip>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent={collapsed ? 'center' : 'flex-start'}
          spacing={1.25}
          sx={{ mt: 1.25 }}
        >
          <Avatar sx={{ width: 28, height: 28, bgcolor: 'success.main', fontSize: 12 }}>
            {user?.name?.slice(0, 2).toUpperCase() || 'MC'}
          </Avatar>
          {!collapsed && (
            <>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={700} noWrap>{user?.name || 'Usuario'}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>{user?.email}</Typography>
              </Box>
              <Tooltip title="Salir">
                <IconButton size="small" onClick={logout}>
                  <LogoutIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Stack>
        {collapsed && (
          <Tooltip title="Salir" placement="right">
            <IconButton size="small" onClick={logout} sx={{ mt: 1, mx: 'auto', display: 'flex' }}>
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

export default MainNavigation;

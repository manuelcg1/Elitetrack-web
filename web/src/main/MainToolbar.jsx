import { useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Toolbar,
  IconButton,
  OutlinedInput,
  InputAdornment,
  Popover,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Badge,
  ListItemButton,
  ListItemText,
  Tooltip,
  Box,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import MapIcon from '@mui/icons-material/Map';
import DnsIcon from '@mui/icons-material/Dns';
import AddIcon from '@mui/icons-material/Add';
import TuneIcon from '@mui/icons-material/Tune';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useDeviceReadonly } from '../common/util/permissions';
import DeviceRow from './DeviceRow';
import { useColorMode } from '../AppThemeProvider';
import GroupFilter from '../groups/GroupFilter';

const useStyles = makeStyles()((theme) => ({
  toolbar: {
    display: 'flex',
    gap: theme.spacing(1),
    position: 'relative',
    minHeight: 52,
    padding: theme.spacing(1, 1.25),
    backgroundColor: theme.palette.background.paper,
    [theme.breakpoints.up('md')]: {
      gap: theme.spacing(0.75),
    },
  },
  filterPanel: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2),
    gap: theme.spacing(2),
    width: theme.dimensions.drawerWidthTablet,
  },
}));

const MainToolbar = ({
  filteredDevices,
  devicesOpen,
  setDevicesOpen,
  keyword,
  setKeyword,
  filter,
  setFilter,
  filterSort,
  setFilterSort,
  filterMap,
  setFilterMap,
  selectedGroupId,
  onGroupSelect,
}) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const navigate = useNavigate();
  const t = useTranslation();
  const { darkMode, toggleDarkMode } = useColorMode();

  const deviceReadonly = useDeviceReadonly();
  const groups = useSelector((state) => state.groups.items);
  const devices = useSelector((state) => state.devices.items);

  const toolbarRef = useRef();
  const inputRef = useRef();
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [devicesAnchorEl, setDevicesAnchorEl] = useState(null);

  const deviceStatusCount = (status) =>
    Object.values(devices).filter((d) => d.status === status).length;

  const hasActiveFilter = filter.statuses.length > 0
    || filter.groups.length > 0
    || Boolean(selectedGroupId);

  return (
    <Toolbar ref={toolbarRef} className={classes.toolbar}>
      {!desktop && (
        <IconButton edge="start" onClick={() => setDevicesOpen(!devicesOpen)}>
          {devicesOpen ? <MapIcon /> : <DnsIcon />}
        </IconButton>
      )}

      {/* Buscador */}
      <OutlinedInput
        ref={inputRef}
        placeholder={t('sharedSearchDevices')}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onFocus={() => setDevicesAnchorEl(toolbarRef.current)}
        onBlur={() => setDevicesAnchorEl(null)}
        endAdornment={
          <InputAdornment position="end">
            <IconButton
              size="small"
              edge="end"
              onClick={() => setFilterAnchorEl(inputRef.current)}
            >
              <Badge color="info" variant="dot" invisible={!hasActiveFilter}>
                <TuneIcon fontSize="small" />
              </Badge>
            </IconButton>
          </InputAdornment>
        }
        size="small"
        fullWidth
        sx={{
          borderRadius: 2,
          backgroundColor: 'action.hover',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'success.main' },
        }}
      />

      {/* Popover preview dispositivos */}
      <Popover
        open={!!devicesAnchorEl && !devicesOpen}
        anchorEl={devicesAnchorEl}
        onClose={() => setDevicesAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: Number(theme.spacing(2).slice(0, -2)),
        }}
        marginThreshold={0}
        slotProps={{
          paper: {
            style: {
              width: `calc(${toolbarRef.current?.clientWidth}px - ${theme.spacing(4)})`,
            },
          },
        }}
        elevation={1}
        disableAutoFocus
        disableEnforceFocus
      >
        {filteredDevices.slice(0, 3).map((_, index) => (
          <DeviceRow
            key={filteredDevices[index].id}
            devices={filteredDevices}
            index={index}
          />
        ))}
        {filteredDevices.length > 3 && (
          <ListItemButton alignItems="center" onClick={() => setDevicesOpen(true)}>
            <ListItemText
              primary={t('notificationAlways')}
              style={{ textAlign: 'center' }}
            />
          </ListItemButton>
        )}
      </Popover>

      {/* Popover filtros avanzados */}
      <Popover
        open={!!filterAnchorEl}
        anchorEl={filterAnchorEl}
        onClose={() => setFilterAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <div className={classes.filterPanel}>
          <FormControl>
            <InputLabel>{t('deviceStatus')}</InputLabel>
            <Select
              label={t('deviceStatus')}
              value={filter.statuses}
              onChange={(e) => setFilter({ ...filter, statuses: e.target.value })}
              multiple
            >
              <MenuItem value="online">
                {`${t('deviceStatusOnline')} (${deviceStatusCount('online')})`}
              </MenuItem>
              <MenuItem value="offline">
                {`${t('deviceStatusOffline')} (${deviceStatusCount('offline')})`}
              </MenuItem>
              <MenuItem value="unknown">
                {`${t('deviceStatusUnknown')} (${deviceStatusCount('unknown')})`}
              </MenuItem>
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>{t('settingsGroups')}</InputLabel>
            <Select
              label={t('settingsGroups')}
              value={filter.groups}
              onChange={(e) => setFilter({ ...filter, groups: e.target.value })}
              multiple
            >
              {Object.values(groups)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    {group.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>{t('sharedSortBy')}</InputLabel>
            <Select
              label={t('sharedSortBy')}
              value={filterSort}
              onChange={(e) => setFilterSort(e.target.value)}
              displayEmpty
            >
              <MenuItem value="">{'\u00a0'}</MenuItem>
              <MenuItem value="name">{t('sharedName')}</MenuItem>
              <MenuItem value="lastUpdate">{t('deviceLastUpdate')}</MenuItem>
            </Select>
          </FormControl>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={filterMap}
                  onChange={(e) => setFilterMap(e.target.checked)}
                />
              }
              label={t('sharedFilterMap')}
            />
          </FormGroup>
        </div>
      </Popover>

      {/* Filtro por árbol de grupos */}
      <Box sx={{ position: 'relative', display: desktop ? 'none' : 'block' }}>
        <GroupFilter
          selectedGroupId={selectedGroupId}
          onGroupSelect={onGroupSelect}
        />
      </Box>

      {/* Toggle dark mode */}
      {!desktop && (
        <Tooltip title={darkMode ? 'Modo claro' : 'Modo oscuro'}>
          <IconButton onClick={toggleDarkMode}>
            {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Tooltip>
      )}

      {/* Agregar dispositivo */}
      <IconButton
        edge="end"
        onClick={() => navigate('/settings/device')}
        disabled={deviceReadonly}
      >
        <Tooltip
          open={!deviceReadonly && Object.keys(devices).length === 0}
          title={t('deviceRegisterFirst')}
          arrow
        >
          <AddIcon />
        </Tooltip>
      </IconButton>
    </Toolbar>
  );
};

export default MainToolbar;

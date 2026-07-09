import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import EditIcon from '@mui/icons-material/Edit';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import MapIcon from '@mui/icons-material/Map';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import SpeedIcon from '@mui/icons-material/Speed';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import PageLayout from '../common/components/PageLayout';
import MonitoringMenu from './MonitoringMenu';
import fetchOrThrow from '../common/util/fetchOrThrow';

const eliteGreen = '#00c853';

const alertTypes = [
  { value: 'speed', label: 'Velocidad' },
  { value: 'geofenceEnter', label: 'Entrada a geocerca' },
  { value: 'geofenceExit', label: 'Salida de geocerca' },
  { value: 'batteryLow', label: 'Bateria baja' },
  { value: 'ignitionOn', label: 'Ignicion encendida' },
  { value: 'ignitionOff', label: 'Ignicion apagada' },
  { value: 'stoppedTooLong', label: 'Detenido demasiado tiempo' },
];

const severities = [
  { value: 'low', label: 'Baja', color: 'success' },
  { value: 'medium', label: 'Media', color: 'info' },
  { value: 'high', label: 'Alta', color: 'warning' },
  { value: 'critical', label: 'Critica', color: 'error' },
];

const operators = [
  { value: 'greaterThan', label: 'Mayor que' },
  { value: 'greaterOrEqual', label: 'Mayor o igual' },
  { value: 'lessThan', label: 'Menor que' },
  { value: 'lessOrEqual', label: 'Menor o igual' },
];

const notificationChannels = [
  { key: 'platform', label: 'Plataforma' },
  { key: 'email', label: 'Correo' },
  { key: 'push', label: 'Push' },
  { key: 'webhook', label: 'Webhook' },
];

const steps = ['Informacion', 'Condicion', 'Destinos', 'Notificaciones', 'Resumen'];
const eventPollInterval = 30000;
const eventPageSize = 200;

const emptyAlert = {
  name: '',
  type: 'speed',
  description: '',
  severity: 'medium',
  active: true,
  limitValue: 90,
  unit: 'km/h',
  operator: 'greaterThan',
  deviceIds: [],
  groupIds: [],
  geofenceIds: [],
  geofenceGroupIds: [],
  attributes: {
    minimumDuration: '',
    resolveThreshold: '',
    notifications: {
      platform: true,
      email: false,
      push: false,
      webhook: false,
    },
  },
};

const optionKey = (option) => `${option.kind}:${option.id}`;

const getTypeLabel = (value) => alertTypes.find((type) => type.value === value)?.label || value || '-';
const getSeverity = (value) => severities.find((severity) => severity.value === value) || severities[1];
const statusLabels = {
  open: 'Abierta',
  acknowledged: 'Atendida',
  resolved: 'Resuelta',
  dismissed: 'Descartada',
};

const statusColors = {
  open: 'warning',
  acknowledged: 'info',
  resolved: 'success',
  dismissed: 'default',
};

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : '-');

const relativeTime = (value) => {
  if (!value) {
    return '-';
  }
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) {
    return 'Hace menos de 1 min';
  }
  if (minutes < 60) {
    return `Hace ${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Hace ${hours} h`;
  }
  return `Hace ${Math.floor(hours / 24)} d`;
};

const eventLocation = (event) => {
  if (event.address) {
    return event.address;
  }
  if (event.latitude && event.longitude) {
    return `${Number(event.latitude).toFixed(5)}, ${Number(event.longitude).toFixed(5)}`;
  }
  return 'Sin ubicacion';
};

const eventIcon = (type) => {
  switch (type) {
    case 'speed':
      return <SpeedIcon />;
    default:
      return <WarningAmberIcon />;
  }
};

const normalizeAlert = (alert = {}) => ({
  ...emptyAlert,
  ...alert,
  type: alert.type === 'Velocidad' ? 'speed' : alert.type || 'speed',
  limitValue: alert.limitValue ?? alert.speedLimit ?? 90,
  groupIds: alert.groupIds || alert.vehicleGroupIds || [],
  deviceIds: alert.deviceIds || [],
  geofenceIds: alert.geofenceIds || [],
  geofenceGroupIds: alert.geofenceGroupIds || [],
  attributes: {
    ...emptyAlert.attributes,
    ...(alert.attributes || {}),
    notifications: {
      ...emptyAlert.attributes.notifications,
      ...(alert.attributes?.notifications || {}),
    },
  },
});

const loadJson = async (urls, retryWhenEmpty = false) => {
  const endpoints = Array.isArray(urls) ? urls : [urls];
  let emptyResult = [];

  for (const endpoint of endpoints) {
    try {
      const response = await fetchOrThrow(endpoint);
      const data = await response.json();
      if (!retryWhenEmpty || !Array.isArray(data) || data.length) {
        return data;
      }
      emptyResult = data;
    } catch {
      // Try the next compatible Traccar endpoint.
    }
  }

  return emptyResult;
};

const mergeById = (current, incoming) => {
  const result = new Map(current.map((event) => [event.id, event]));
  incoming.forEach((event) => result.set(event.id, event));
  return [...result.values()].sort((first, second) => new Date(second.eventTime || 0) - new Date(first.eventTime || 0));
};

const buildEventQuery = (filters = {}, options = {}) => {
  const query = new URLSearchParams();
  query.set('limit', String(options.limit || eventPageSize));
  query.set('offset', String(options.offset || 0));

  if (options.status) {
    query.set('status', options.status);
  } else if (filters.status && filters.status !== 'all') {
    query.set('status', filters.status);
  }
  if (filters.severity && filters.severity !== 'all') {
    query.set('severity', filters.severity);
  }
  if (filters.type && filters.type !== 'all') {
    query.set('type', filters.type);
  }
  if (filters.target?.kind === 'device') {
    query.set('deviceId', String(filters.target.id));
  }
  if (filters.target?.kind === 'group') {
    query.set('groupId', String(filters.target.id));
  }
  if (filters.from) {
    query.set('dateFrom', new Date(`${filters.from}T00:00:00`).toISOString());
  } else if (options.defaultDays) {
    query.set('dateFrom', new Date(Date.now() - options.defaultDays * 24 * 60 * 60 * 1000).toISOString());
  }
  if (filters.to) {
    query.set('dateTo', new Date(`${filters.to}T23:59:59`).toISOString());
  }

  return `/api/alert-events?${query.toString()}`;
};

const KpiCard = ({ title, value, icon, color = eliteGreen }) => (
  <Paper
    elevation={0}
    sx={{
      p: 2,
      borderRadius: 2,
      border: '1px solid',
      borderColor: 'divider',
      bgcolor: 'background.paper',
      minHeight: 96,
    }}
  >
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Avatar sx={{ bgcolor: `${color}18`, color, width: 42, height: 42 }}>{icon}</Avatar>
      <Box>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
          {value}
        </Typography>
      </Box>
    </Stack>
  </Paper>
);

const MonitoringAlertsPage = () => {
  const compactDetail = useMediaQuery('(max-width:1199px)');
  const [alerts, setAlerts] = useState([]);
  const [events, setEvents] = useState([]);
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [geofenceFolders, setGeofenceFolders] = useState([]);
  const [item, setItem] = useState(emptyAlert);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    type: 'all',
    status: 'all',
    severity: 'all',
    target: null,
  });
  const [eventFilters, setEventFilters] = useState({
    search: '',
    type: 'all',
    status: 'all',
    severity: 'all',
    target: null,
    date: '',
    recent: true,
  });
  const [historyFilters, setHistoryFilters] = useState({
    from: '',
    to: '',
    type: 'all',
    status: 'all',
    severity: 'all',
    target: null,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [alertToDelete, setAlertToDelete] = useState(null);
  const [deletingAlert, setDeletingAlert] = useState(false);

  const vehicleOptions = useMemo(
    () => [
      ...groups.map((group) => ({
        id: group.id,
        kind: 'group',
        group: 'Flotas',
        label: group.name,
      })),
      ...devices.map((device) => ({
        id: device.id,
        kind: 'device',
        group: 'Vehiculos',
        label: device.name || device.uniqueId,
      })),
    ],
    [devices, groups],
  );

  const geofenceOptions = useMemo(
    () => [
      ...geofenceFolders.map((folder) => ({
        id: folder.id,
        kind: 'folder',
        group: 'Grupos de geocercas',
        label: folder.name,
      })),
      ...geofences.map((geofence) => ({
        id: geofence.id,
        kind: 'geofence',
        group: 'Geocercas',
        label: geofence.name,
      })),
    ],
    [geofences, geofenceFolders],
  );

  const selectedVehicleOptions = useMemo(
    () =>
      vehicleOptions.filter((option) =>
        option.kind === 'device'
          ? item.deviceIds.includes(option.id)
          : item.groupIds.includes(option.id),
      ),
    [item.deviceIds, item.groupIds, vehicleOptions],
  );

  const selectedGeofenceOptions = useMemo(
    () =>
      geofenceOptions.filter((option) =>
        option.kind === 'geofence'
          ? item.geofenceIds.includes(option.id)
          : item.geofenceGroupIds.includes(option.id),
      ),
    [item.geofenceIds, item.geofenceGroupIds, geofenceOptions],
  );

  const targetOptions = useMemo(() => [{ id: 0, kind: 'all', label: 'Todos' }, ...vehicleOptions], [vehicleOptions]);

  const deviceMap = useMemo(() => new Map(devices.map((device) => [device.id, device])), [devices]);
  const groupMap = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const alertMap = useMemo(() => new Map(alerts.map((alert) => [alert.id, alert])), [alerts]);

  const enrichedEvents = useMemo(
    () =>
      events.map((event) => {
        const device = deviceMap.get(event.deviceId);
        const alert = alertMap.get(event.alertId);
        const group = event.groupId ? groupMap.get(event.groupId) : device ? groupMap.get(device.groupId) : null;
        return {
          ...event,
          alertName: alert?.name || event.message || `Alerta ${event.alertId || ''}`,
          alertConfig: alert,
          deviceName: device?.name || device?.uniqueId || `Vehiculo ${event.deviceId || '-'}`,
          driverName: event.driver || event.attributes?.driver || '-',
          groupId: event.groupId || group?.id || 0,
          groupName: group?.name || '-',
          severity: event.severity || alert?.severity || 'medium',
          type: event.type || alert?.type || 'speed',
          status: event.status || 'open',
          unit: event.unit || alert?.unit || 'km/h',
          threshold: event.threshold || alert?.limitValue || 0,
        };
      }),
    [alertMap, deviceMap, events, groupMap],
  );

  const todayEvents = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return events.filter((event) => event.eventTime && new Date(event.eventTime) >= start);
  }, [events]);

  const kpis = useMemo(
    () => ({
      active: alerts.filter((alert) => alert.active).length,
      inactive: alerts.filter((alert) => !alert.active).length,
      today: todayEvents.length,
      critical: alerts.filter((alert) => alert.severity === 'critical').length,
      open: events.filter((event) => event.status === 'open').length,
    }),
    [alerts, events, todayEvents.length],
  );

  const eventKpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      open: enrichedEvents.filter((event) => event.status === 'open').length,
      critical: enrichedEvents.filter((event) => event.severity === 'critical').length,
      acknowledged: enrichedEvents.filter((event) => event.status === 'acknowledged').length,
      resolvedToday: enrichedEvents.filter(
        (event) => event.status === 'resolved' && event.resolvedAt && new Date(event.resolvedAt) >= today,
      ).length,
      unattended: enrichedEvents.filter((event) => event.status === 'open').length,
    };
  }, [enrichedEvents]);

  const filterEvents = (source, currentFilters) => {
    const filtered = source.filter((event) => {
      const text =
        `${event.alertName || ''} ${event.deviceName || ''} ${event.driverName || ''}`.toLowerCase();
      const matchesSearch = text.includes((currentFilters.search || '').toLowerCase());
      const matchesType = currentFilters.type === 'all' || event.type === currentFilters.type;
      const matchesStatus = currentFilters.status === 'all' || event.status === currentFilters.status;
      const matchesSeverity = currentFilters.severity === 'all' || event.severity === currentFilters.severity;
      const matchesTarget =
        !currentFilters.target ||
        currentFilters.target.kind === 'all' ||
        (currentFilters.target.kind === 'device' && event.deviceId === currentFilters.target.id) ||
        (currentFilters.target.kind === 'group' && event.groupId === currentFilters.target.id);
      const matchesDate =
        !currentFilters.date ||
        (event.eventTime && new Date(event.eventTime).toISOString().slice(0, 10) === currentFilters.date);
      const matchesFrom =
        !currentFilters.from || (event.eventTime && new Date(event.eventTime) >= new Date(currentFilters.from));
      const matchesTo =
        !currentFilters.to ||
        (event.eventTime && new Date(event.eventTime) <= new Date(`${currentFilters.to}T23:59:59`));

      return (
        matchesSearch &&
        matchesType &&
        matchesStatus &&
        matchesSeverity &&
        matchesTarget &&
        matchesDate &&
        matchesFrom &&
        matchesTo
      );
    });

    return currentFilters.recent === false
      ? filtered
      : [...filtered].sort((first, second) => new Date(second.eventTime || 0) - new Date(first.eventTime || 0));
  };

  const realtimeEvents = useMemo(
    () => filterEvents(enrichedEvents.filter((event) => ['open', 'acknowledged'].includes(event.status)), eventFilters),
    [enrichedEvents, eventFilters],
  );

  const historyEvents = useMemo(
    () => filterEvents(enrichedEvents, { ...historyFilters, search: '' }),
    [enrichedEvents, historyFilters],
  );

  const selectedEventDetail = useMemo(
    () => enrichedEvents.find((event) => event.id === selectedEvent?.id) || selectedEvent,
    [enrichedEvents, selectedEvent],
  );

  const filteredAlerts = useMemo(
    () =>
      alerts.filter((alert) => {
        const text = `${alert.name || ''} ${getTypeLabel(alert.type)}`.toLowerCase();
        const matchesSearch = text.includes(filters.search.toLowerCase());
        const matchesType = filters.type === 'all' || alert.type === filters.type;
        const matchesStatus =
          filters.status === 'all' ||
          (filters.status === 'active' && alert.active) ||
          (filters.status === 'inactive' && !alert.active);
        const matchesSeverity = filters.severity === 'all' || alert.severity === filters.severity;
        const matchesTarget =
          !filters.target ||
          filters.target.kind === 'all' ||
          (filters.target.kind === 'device' && alert.deviceIds.includes(filters.target.id)) ||
          (filters.target.kind === 'group' && alert.groupIds.includes(filters.target.id));

        return matchesSearch && matchesType && matchesStatus && matchesSeverity && matchesTarget;
      }),
    [alerts, filters],
  );

  const formValid =
    item.name.trim() &&
    item.type &&
    item.severity &&
    (item.type !== 'speed' || Number(item.limitValue) > 0);

  const loadData = async () => {
    const [alertsData, eventsData, devicesData, groupsData, geofencesData, foldersData] =
      await Promise.all([
        loadJson('/api/alerts'),
        loadJson(buildEventQuery({}, { limit: eventPageSize })),
        loadJson(['/api/devices?all=true', '/api/devices'], true),
        loadJson(['/api/groups?all=true', '/api/groups'], true),
        loadJson(['/api/geofences?all=true', '/api/geofences'], true),
        loadJson(['/api/geofenceFolders?all=true', '/api/geofenceFolders'], true),
      ]);

    setAlerts(alertsData.map(normalizeAlert));
    setEvents(eventsData);
    setDevices(devicesData);
    setGroups(groupsData);
    setGeofences(geofencesData);
    setGeofenceFolders(foldersData);
  };

  const loadEvents = async () => {
    const [openEvents, acknowledgedEvents] = await Promise.all([
      loadJson(buildEventQuery(eventFilters, { status: 'open', limit: eventPageSize })),
      loadJson(buildEventQuery(eventFilters, { status: 'acknowledged', limit: eventPageSize })),
    ]);
    setEvents((current) => mergeById(current, [...openEvents, ...acknowledgedEvents]));
  };

  const loadHistoryEvents = async () => {
    const historyData = await loadJson(buildEventQuery(historyFilters, { limit: eventPageSize, defaultDays: 7 }));
    setEvents((current) => mergeById(current, historyData));
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const interval = setInterval(loadEvents, eventPollInterval);
    return () => clearInterval(interval);
  }, [eventFilters]);

  useEffect(() => {
    if (activeTab === 1) {
      loadHistoryEvents();
    }
  }, [activeTab, historyFilters]);

  const openNew = () => {
    setItem(emptyAlert);
    setActiveStep(0);
    setSaveError('');
    setDrawerOpen(true);
  };

  const openEdit = (alert) => {
    setItem(normalizeAlert(alert));
    setActiveStep(0);
    setSaveError('');
    setDrawerOpen(true);
  };

  const buildPayload = (source) => ({
    ...source,
    limitValue: Number(source.limitValue),
    unit: source.unit || 'km/h',
    groupIds: source.groupIds || [],
    deviceIds: source.deviceIds || [],
    geofenceIds: source.geofenceIds || [],
    geofenceGroupIds: source.geofenceGroupIds || [],
    attributes: {
      ...(source.attributes || {}),
      minimumDuration: source.attributes?.minimumDuration || '',
      resolveThreshold: source.attributes?.resolveThreshold || '',
      notifications: {
        ...emptyAlert.attributes.notifications,
        ...(source.attributes?.notifications || {}),
      },
    },
  });

  const handleSave = async () => {
    if (!formValid) {
      return;
    }

    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      const payload = buildPayload(item);
      const url = item.id ? `/api/alerts/${item.id}` : '/api/alerts';
      const method = item.id ? 'PUT' : 'POST';
      const response = await fetchOrThrow(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const saved = normalizeAlert(await response.json());
      setAlerts((current) => [saved, ...current.filter((alert) => alert.id !== saved.id)]);
      setDrawerOpen(false);
      setItem(emptyAlert);
      await loadData();
      setSaveSuccess(true);
    } catch (error) {
      setSaveError(error.message || 'No se pudo guardar la alerta');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = (alert) => {
    const copy = normalizeAlert(alert);
    delete copy.id;
    setItem({ ...copy, name: `${copy.name} - copia` });
    setActiveStep(0);
    setSaveError('');
    setDrawerOpen(true);
  };

  const handleToggleActive = async (alert) => {
    const payload = buildPayload({ ...normalizeAlert(alert), active: !alert.active });
    try {
      const response = await fetchOrThrow(`/api/alerts/${alert.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const saved = normalizeAlert(await response.json());
      setAlerts((current) => current.map((currentAlert) => (currentAlert.id === saved.id ? saved : currentAlert)));
    } catch (error) {
      setSaveError(error.message || 'No se pudo actualizar la alerta');
    }
  };

  const handleConfirmDelete = async () => {
    if (!alertToDelete) {
      return;
    }

    setDeletingAlert(true);
    try {
      await fetchOrThrow(`/api/alerts/${alertToDelete.id}`, { method: 'DELETE' });
      setAlerts((current) => current.filter((alert) => alert.id !== alertToDelete.id));
      setAlertToDelete(null);
      await loadData();
    } catch (error) {
      setSaveError(error.message || 'No se pudo eliminar la alerta');
    } finally {
      setDeletingAlert(false);
    }
  };

  const handleEventAction = async (event, action) => {
    try {
      await fetchOrThrow(`/api/alert-events/${event.id}/${action}`, { method: 'PUT' });
      await loadEvents();
      setSelectedEvent((current) =>
        current?.id === event.id
          ? enrichedEvents.find((currentEvent) => currentEvent.id === event.id) || current
          : current,
      );
    } catch (error) {
      setSaveError(error.message || 'No se pudo actualizar el evento');
    }
  };

  const openEventMap = (event) => {
    if (event.latitude && event.longitude) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${event.latitude}%2C${event.longitude}`,
        '_blank',
        'noopener,noreferrer',
      );
    }
  };

  const handleVehicleChange = (_, selected) => {
    setItem((current) => ({
      ...current,
      deviceIds: selected.filter((option) => option.kind === 'device').map((option) => option.id),
      groupIds: selected.filter((option) => option.kind === 'group').map((option) => option.id),
    }));
  };

  const handleGeofenceChange = (_, selected) => {
    setItem((current) => ({
      ...current,
      geofenceIds: selected.filter((option) => option.kind === 'geofence').map((option) => option.id),
      geofenceGroupIds: selected.filter((option) => option.kind === 'folder').map((option) => option.id),
    }));
  };

  const renderOption = (props, option, { selected }) => (
    <li {...props} key={optionKey(option)}>
      <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
      <Box>
        <Typography variant="body2">{option.label}</Typography>
        <Typography variant="caption" color="text.secondary">
          {option.group || (option.kind === 'all' ? 'Alcance global' : '')}
        </Typography>
      </Box>
    </li>
  );

  const updateAttributes = (patch) => {
    setItem((current) => ({
      ...current,
      attributes: {
        ...current.attributes,
        ...patch,
      },
    }));
  };

  const renderFormStep = () => {
    switch (activeStep) {
      case 0:
        return (
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Nombre"
              value={item.name}
              error={!item.name.trim()}
              onChange={(event) => setItem({ ...item, name: event.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Tipo de alerta</InputLabel>
              <Select
                label="Tipo de alerta"
                value={item.type}
                onChange={(event) => setItem({ ...item, type: event.target.value })}
              >
                {alertTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Descripcion"
              value={item.description}
              onChange={(event) => setItem({ ...item, description: event.target.value })}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Severidad</InputLabel>
                <Select
                  label="Severidad"
                  value={item.severity}
                  onChange={(event) => setItem({ ...item, severity: event.target.value })}
                >
                  {severities.map((severity) => (
                    <MenuItem key={severity.value} value={severity.value}>
                      {severity.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControlLabel
                sx={{ minWidth: 180 }}
                control={
                  <Switch
                    checked={item.active}
                    onChange={(event) => setItem({ ...item, active: event.target.checked })}
                  />
                }
                label={item.active ? 'Activa' : 'Inactiva'}
              />
            </Stack>
          </Stack>
        );
      case 1:
        return (
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Operador</InputLabel>
              <Select
                label="Operador"
                value={item.operator}
                onChange={(event) => setItem({ ...item, operator: event.target.value })}
                disabled={item.type !== 'speed'}
              >
                {operators.map((operator) => (
                  <MenuItem key={operator.value} value={operator.value}>
                    {operator.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                type="number"
                label="Limite"
                value={item.limitValue}
                error={item.type === 'speed' && Number(item.limitValue) <= 0}
                onChange={(event) => setItem({ ...item, limitValue: event.target.value })}
                disabled={item.type !== 'speed'}
              />
              <TextField fullWidth label="Unidad" value="km/h" disabled />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                type="number"
                label="Tiempo minimo opcional"
                value={item.attributes.minimumDuration}
                onChange={(event) => updateAttributes({ minimumDuration: event.target.value })}
                InputProps={{ endAdornment: <InputAdornment position="end">seg</InputAdornment> }}
              />
              <TextField
                fullWidth
                type="number"
                label="Umbral para resolver opcional"
                value={item.attributes.resolveThreshold}
                onChange={(event) => updateAttributes({ resolveThreshold: event.target.value })}
                InputProps={{ endAdornment: <InputAdornment position="end">km/h</InputAdornment> }}
              />
            </Stack>
          </Stack>
        );
      case 2:
        return (
          <Stack spacing={2}>
            {!vehicleOptions.length && (
              <Alert severity="warning">
                No tienes vehiculos asignados. Solicita al administrador que te asigne recursos.
              </Alert>
            )}
            <Autocomplete
              multiple
              disableCloseOnSelect
              options={vehicleOptions}
              groupBy={(option) => option.group}
              value={selectedVehicleOptions}
              isOptionEqualToValue={(option, value) => optionKey(option) === optionKey(value)}
              getOptionLabel={(option) => option.label}
              renderOption={renderOption}
              onChange={handleVehicleChange}
              renderInput={(params) => <TextField {...params} label="Vehiculos y flotas" />}
            />
            {!selectedVehicleOptions.length && (
              <Alert severity="info">La alerta aplicara a todos los vehiculos permitidos para tu usuario</Alert>
            )}
            {!geofenceOptions.length && (
              <Alert severity="warning">
                No tienes geocercas asignadas. Solicita al administrador que te asigne recursos.
              </Alert>
            )}
            <Autocomplete
              multiple
              disableCloseOnSelect
              options={geofenceOptions}
              groupBy={(option) => option.group}
              value={selectedGeofenceOptions}
              isOptionEqualToValue={(option, value) => optionKey(option) === optionKey(value)}
              getOptionLabel={(option) => option.label}
              renderOption={renderOption}
              onChange={handleGeofenceChange}
              renderInput={(params) => <TextField {...params} label="Geocercas y grupos" />}
            />
          </Stack>
        );
      case 3:
        return (
          <Stack spacing={1}>
            {notificationChannels.map((channel) => (
              <FormControlLabel
                key={channel.key}
                control={
                  <Switch
                    checked={Boolean(item.attributes.notifications?.[channel.key])}
                    onChange={(event) =>
                      updateAttributes({
                        notifications: {
                          ...item.attributes.notifications,
                          [channel.key]: event.target.checked,
                        },
                      })
                    }
                  />
                }
                label={channel.label}
              />
            ))}
          </Stack>
        );
      default:
        return (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack spacing={1.5}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {item.name || 'Alerta sin nombre'}
              </Typography>
              <Typography color="text.secondary">{getTypeLabel(item.type)}</Typography>
              <Typography>
                {operators.find((operator) => operator.value === item.operator)?.label || item.operator}{' '}
                {item.limitValue} km/h
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip size="small" label={item.active ? 'Activa' : 'Inactiva'} color={item.active ? 'success' : 'default'} />
                <Chip size="small" label={getSeverity(item.severity).label} color={getSeverity(item.severity).color} />
                <Chip size="small" label={`${selectedVehicleOptions.length || 'Todos'} destino(s)`} />
              </Stack>
            </Stack>
          </Paper>
        );
    }
  };

  const conditionText = (alert) => {
    if (alert.type !== 'speed') {
      return '-';
    }
    const operator = operators.find((itemOperator) => itemOperator.value === alert.operator)?.label || 'Mayor que';
    return `${operator} ${alert.limitValue} km/h`;
  };

  const renderEventActions = (event) => (
    <Stack direction="row" spacing={0.5} flexWrap="wrap">
      <Tooltip title="Ver en mapa">
        <span>
          <IconButton
            size="small"
            disabled={!event.latitude || !event.longitude}
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              openEventMap(event);
            }}
          >
            <MapIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Atender">
        <span>
          <IconButton
            size="small"
            disabled={event.status !== 'open'}
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              handleEventAction(event, 'acknowledge');
            }}
          >
            <CheckCircleIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Resolver">
        <span>
          <IconButton
            size="small"
            color="success"
            disabled={event.status === 'resolved' || event.status === 'dismissed'}
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              handleEventAction(event, 'resolve');
            }}
          >
            <SaveIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Descartar">
        <span>
          <IconButton
            size="small"
            color="error"
            disabled={event.status === 'resolved' || event.status === 'dismissed'}
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              handleEventAction(event, 'dismiss');
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );

  const renderEventFilters = (currentFilters, setCurrentFilters, includeDateRange = false) => (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <FilterAltIcon color="action" />
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
          Filtros
        </Typography>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: includeDateRange ? 'repeat(4, 1fr)' : '2fr repeat(5, 1fr)' },
          gap: 1.5,
        }}
      >
        {!includeDateRange && (
          <TextField
            label="Buscar vehiculo, conductor o alerta"
            value={currentFilters.search}
            onChange={(event) => setCurrentFilters((current) => ({ ...current, search: event.target.value }))}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        )}
        {includeDateRange && (
          <>
            <TextField
              type="date"
              label="Desde"
              value={currentFilters.from}
              onChange={(event) => setCurrentFilters((current) => ({ ...current, from: event.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              type="date"
              label="Hasta"
              value={currentFilters.to}
              onChange={(event) => setCurrentFilters((current) => ({ ...current, to: event.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </>
        )}
        <FormControl>
          <InputLabel>Tipo</InputLabel>
          <Select
            label="Tipo"
            value={currentFilters.type}
            onChange={(event) => setCurrentFilters((current) => ({ ...current, type: event.target.value }))}
          >
            <MenuItem value="all">Todos</MenuItem>
            {alertTypes.map((type) => (
              <MenuItem key={type.value} value={type.value}>
                {type.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl>
          <InputLabel>Severidad</InputLabel>
          <Select
            label="Severidad"
            value={currentFilters.severity}
            onChange={(event) => setCurrentFilters((current) => ({ ...current, severity: event.target.value }))}
          >
            <MenuItem value="all">Todas</MenuItem>
            {severities.map((severity) => (
              <MenuItem key={severity.value} value={severity.value}>
                {severity.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl>
          <InputLabel>Estado</InputLabel>
          <Select
            label="Estado"
            value={currentFilters.status}
            onChange={(event) => setCurrentFilters((current) => ({ ...current, status: event.target.value }))}
          >
            <MenuItem value="all">Todos</MenuItem>
            {Object.entries(statusLabels).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Autocomplete
          options={targetOptions}
          value={currentFilters.target}
          isOptionEqualToValue={(option, value) => optionKey(option) === optionKey(value)}
          getOptionLabel={(option) => option?.label || ''}
          onChange={(_, selected) => setCurrentFilters((current) => ({ ...current, target: selected }))}
          renderInput={(params) => <TextField {...params} label="Flota / vehiculo" />}
        />
        {!includeDateRange && (
          <TextField
            type="date"
            label="Fecha"
            value={currentFilters.date}
            onChange={(event) => setCurrentFilters((current) => ({ ...current, date: event.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
        )}
        {!includeDateRange && (
          <FormControlLabel
            sx={{ m: 0, minHeight: 56 }}
            control={
              <Switch
                checked={currentFilters.recent}
                onChange={(event) => setCurrentFilters((current) => ({ ...current, recent: event.target.checked }))}
              />
            }
            label="Mas reciente"
          />
        )}
      </Box>
    </Paper>
  );

  const renderEventCards = () => (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: selectedEvent ? 'minmax(0, 1fr) 360px' : '1fr' },
        gap: 2,
        alignItems: 'start',
      }}
    >
      <Stack spacing={1.5}>
        {realtimeEvents.map((event) => (
          <Paper
            key={event.id}
            elevation={0}
            onClick={() => setSelectedEvent(event)}
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: selectedEventDetail?.id === event.id ? eliteGreen : 'divider',
              cursor: 'pointer',
              bgcolor: 'background.paper',
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
              <Avatar sx={{ bgcolor: `${eliteGreen}18`, color: eliteGreen }}>{eventIcon(event.type)}</Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                    {event.alertName}
                  </Typography>
                  <Chip size="small" label={getSeverity(event.severity).label} color={getSeverity(event.severity).color} />
                  <Chip size="small" label={statusLabels[event.status] || event.status} color={statusColors[event.status]} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {event.deviceName} · Conductor: {event.driverName}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Valor {Number(event.value || 0).toFixed(1)} {event.unit} · Limite{' '}
                  {Number(event.threshold || 0).toFixed(1)} {event.unit}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {relativeTime(event.eventTime)} · {eventLocation(event)}
                </Typography>
              </Box>
              {renderEventActions(event)}
            </Stack>
          </Paper>
        ))}
        {!realtimeEvents.length && (
          <Paper elevation={0} sx={{ p: 5, textAlign: 'center', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <NotificationsActiveIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">
              {events.some((event) => event.status === 'open')
                ? 'No se encontraron eventos con los filtros seleccionados'
                : 'No hay eventos abiertos'}
            </Typography>
          </Paper>
        )}
      </Stack>
      {selectedEventDetail && (
        <Paper
          elevation={0}
          sx={{
            display: { xs: 'none', lg: 'block' },
            p: 2,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            position: 'sticky',
            top: 16,
          }}
        >
          {renderEventDetail(selectedEventDetail, false)}
        </Paper>
      )}
    </Box>
  );

  const renderHistory = () => (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ flex: 1, fontWeight: 900 }}>
          Historial de eventos
        </Typography>
      </Stack>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Severidad</TableCell>
              <TableCell>Alerta</TableCell>
              <TableCell>Vehiculo</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Valor</TableCell>
              <TableCell>Ubicacion</TableCell>
              <TableCell>Atendido por</TableCell>
              <TableCell>Resuelto en</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {historyEvents.map((event) => (
              <TableRow key={event.id} hover onClick={() => setSelectedEvent(event)} sx={{ cursor: 'pointer' }}>
                <TableCell>{formatDateTime(event.eventTime)}</TableCell>
                <TableCell>
                  <Chip size="small" label={statusLabels[event.status] || event.status} color={statusColors[event.status]} />
                </TableCell>
                <TableCell>
                  <Chip size="small" label={getSeverity(event.severity).label} color={getSeverity(event.severity).color} variant="outlined" />
                </TableCell>
                <TableCell>{event.alertName}</TableCell>
                <TableCell>{event.deviceName}</TableCell>
                <TableCell>{getTypeLabel(event.type)}</TableCell>
                <TableCell>
                  {Number(event.value || 0).toFixed(1)} {event.unit}
                </TableCell>
                <TableCell>{eventLocation(event)}</TableCell>
                <TableCell>{event.acknowledgedBy || '-'}</TableCell>
                <TableCell>{formatDateTime(event.resolvedAt)}</TableCell>
                <TableCell align="right">{renderEventActions(event)}</TableCell>
              </TableRow>
            ))}
            {!historyEvents.length && (
              <TableRow>
                <TableCell colSpan={11}>
                  <Box sx={{ py: 5, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      No se encontraron eventos con los filtros seleccionados
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );

  const renderEventDetail = (event, showClose = true) => (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Avatar sx={{ bgcolor: `${eliteGreen}18`, color: eliteGreen }}>{eventIcon(event.type)}</Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            {event.alertName}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip size="small" label={statusLabels[event.status] || event.status} color={statusColors[event.status]} />
            <Chip size="small" label={getSeverity(event.severity).label} color={getSeverity(event.severity).color} />
          </Stack>
        </Box>
        {showClose && (
          <IconButton onClick={() => setSelectedEvent(null)}>
            <CloseIcon />
          </IconButton>
        )}
      </Stack>
      <Divider />
      {[
        ['Vehiculo', event.deviceName],
        ['Conductor', event.driverName],
        ['Flota', event.groupName],
        ['Fecha y hora', formatDateTime(event.eventTime)],
        ['Valor detectado', `${Number(event.value || 0).toFixed(1)} ${event.unit}`],
        ['Limite', `${Number(event.threshold || 0).toFixed(1)} ${event.unit}`],
        ['Direccion', eventLocation(event)],
        ['Coordenadas', event.latitude && event.longitude ? `${event.latitude}, ${event.longitude}` : '-'],
        ['Tipo de alerta', getTypeLabel(event.type)],
        ['Alerta configurada', event.alertConfig?.name || '-'],
      ].map(([label, value]) => (
        <Box key={label}>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {value}
          </Typography>
        </Box>
      ))}
      <Box>
        <Typography variant="caption" color="text.secondary">
          Canales notificados
        </Typography>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mt: 0.5 }}>
          {notificationChannels
            .filter((channel) => event.alertConfig?.attributes?.notifications?.[channel.key])
            .map((channel) => (
              <Chip key={channel.key} size="small" label={channel.label} />
            ))}
          {!notificationChannels.some((channel) => event.alertConfig?.attributes?.notifications?.[channel.key]) && (
            <Typography variant="body2">-</Typography>
          )}
        </Stack>
      </Box>
      {event.latitude && event.longitude && (
        <Box
          sx={{
            height: 150,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#ecfdf3',
            color: eliteGreen,
            fontWeight: 900,
          }}
        >
          <Stack alignItems="center" spacing={0.5}>
            <MapIcon />
            <Typography variant="body2">{Number(event.latitude).toFixed(5)}, {Number(event.longitude).toFixed(5)}</Typography>
          </Stack>
        </Box>
      )}
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
          Linea de tiempo
        </Typography>
        {[
          ['Evento generado', event.eventTime],
          ['Notificacion enviada', event.attributes?.notificationTime],
          ['Atendido por usuario', event.acknowledgedAt],
          [event.status === 'dismissed' ? 'Descartado' : 'Resuelto', event.resolvedAt || event.dismissedAt],
        ].map(([label, value]) => (
          <Stack key={label} direction="row" spacing={1} sx={{ py: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: value ? eliteGreen : 'divider', mt: 0.75 }} />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{label}</Typography>
              <Typography variant="caption" color="text.secondary">{formatDateTime(value)}</Typography>
            </Box>
          </Stack>
        ))}
      </Box>
      {renderEventActions(event)}
    </Stack>
  );

  return (
    <PageLayout menu={<MonitoringMenu />} breadcrumbs={['Monitoreo', 'Alertas']}>
      <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Snackbar
          open={saveSuccess}
          autoHideDuration={3500}
          onClose={() => setSaveSuccess(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={() => setSaveSuccess(false)} severity="success" variant="filled">
            Alerta guardada correctamente
          </Alert>
        </Snackbar>

        {saveError && (
          <Alert severity="error" onClose={() => setSaveError('')}>
            {saveError}
          </Alert>
        )}

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 900 }}>
                Alertas
              </Typography>
              <Typography color="text.secondary">
                Configura reglas para detectar eventos importantes de tu flota.
              </Typography>
            </Box>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openNew} sx={{ bgcolor: eliteGreen }}>
              Nueva alerta
            </Button>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, value) => setActiveTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 1 }}
          >
            <Tab label="Eventos en tiempo real" />
            <Tab label="Historial de eventos" />
            <Tab label="Configuracion de alertas" />
          </Tabs>
        </Paper>

        {activeTab === 0 && (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' },
                gap: 2,
              }}
            >
              <KpiCard title="Alertas abiertas" value={eventKpis.open} icon={<ErrorOutlineIcon />} color="#f59e0b" />
              <KpiCard title="Criticas" value={eventKpis.critical} icon={<WarningAmberIcon />} color="#dc2626" />
              <KpiCard title="Atendidas" value={eventKpis.acknowledged} icon={<CheckCircleIcon />} color="#0284c7" />
              <KpiCard title="Resueltas hoy" value={eventKpis.resolvedToday} icon={<SaveIcon />} />
              <KpiCard title="Sin atender" value={eventKpis.unattended} icon={<NotificationsActiveIcon />} color="#f59e0b" />
            </Box>
            {renderEventFilters(eventFilters, setEventFilters)}
            {renderEventCards()}
          </>
        )}

        {activeTab === 1 && (
          <>
            {renderEventFilters(historyFilters, setHistoryFilters, true)}
            {renderHistory()}
          </>
        )}

        {activeTab === 2 && (
          <>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' },
            gap: 2,
          }}
        >
          <KpiCard title="Alertas activas" value={kpis.active} icon={<CheckCircleIcon />} />
          <KpiCard title="Alertas inactivas" value={kpis.inactive} icon={<PowerSettingsNewIcon />} color="#64748b" />
          <KpiCard title="Eventos hoy" value={kpis.today} icon={<NotificationsActiveIcon />} color="#0284c7" />
          <KpiCard title="Criticas" value={kpis.critical} icon={<WarningAmberIcon />} color="#dc2626" />
          <KpiCard title="Sin atender" value={kpis.open} icon={<ErrorOutlineIcon />} color="#f59e0b" />
        </Box>

        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <FilterAltIcon color="action" />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Filtros
            </Typography>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '2fr repeat(4, 1fr)' },
              gap: 1.5,
            }}
          >
            <TextField
              label="Buscar por nombre"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl>
              <InputLabel>Tipo</InputLabel>
              <Select
                label="Tipo"
                value={filters.type}
                onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
              >
                <MenuItem value="all">Todos</MenuItem>
                {alertTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel>Estado</InputLabel>
              <Select
                label="Estado"
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              >
                <MenuItem value="all">Todos</MenuItem>
                <MenuItem value="active">Activa</MenuItem>
                <MenuItem value="inactive">Inactiva</MenuItem>
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel>Severidad</InputLabel>
              <Select
                label="Severidad"
                value={filters.severity}
                onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}
              >
                <MenuItem value="all">Todas</MenuItem>
                {severities.map((severity) => (
                  <MenuItem key={severity.value} value={severity.value}>
                    {severity.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Autocomplete
              options={targetOptions}
              value={filters.target}
              isOptionEqualToValue={(option, value) => optionKey(option) === optionKey(value)}
              getOptionLabel={(option) => option?.label || ''}
              onChange={(_, selected) => setFilters((current) => ({ ...current, target: selected }))}
              renderInput={(params) => <TextField {...params} label="Vehiculo / flota" />}
            />
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 900 }}>
            Alertas configuradas
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow
                  sx={{
                    '& th': {
                      bgcolor: '#ecfdf3',
                      color: '#009624',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: 0,
                      fontSize: 12,
                    },
                  }}
                >
                  <TableCell>Estado</TableCell>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Condicion</TableCell>
                  <TableCell>Severidad</TableCell>
                  <TableCell>Vehiculos / flotas</TableCell>
                  <TableCell>Geocercas / grupos</TableCell>
                  <TableCell>Ultima actualizacion</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAlerts.map((alert) => (
                  <TableRow key={alert.id} hover>
                    <TableCell>
                      <Chip
                        size="small"
                        label={alert.active ? 'Activa' : 'Inactiva'}
                        color={alert.active ? 'success' : 'default'}
                        sx={{ fontWeight: 800 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {alert.name}
                      </Typography>
                      {alert.description && (
                        <Typography variant="caption" color="text.secondary">
                          {alert.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{getTypeLabel(alert.type)}</TableCell>
                    <TableCell>{conditionText(alert)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={getSeverity(alert.severity).label}
                        color={getSeverity(alert.severity).color}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{(alert.deviceIds.length || 0) + (alert.groupIds.length || 0) || 'Todos'}</TableCell>
                    <TableCell>{(alert.geofenceIds.length || 0) + (alert.geofenceGroupIds.length || 0) || '-'}</TableCell>
                    <TableCell>
                      {alert.updatedAt ? new Date(alert.updatedAt).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(alert)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Duplicar">
                        <IconButton size="small" onClick={() => handleDuplicate(alert)}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={alert.active ? 'Inactivar' : 'Activar'}>
                        <IconButton size="small" onClick={() => handleToggleActive(alert)}>
                          <PowerSettingsNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton size="small" color="error" onClick={() => setAlertToDelete(alert)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredAlerts.length && (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Box sx={{ py: 5, textAlign: 'center' }}>
                        <SpeedIcon sx={{ color: 'text.disabled', fontSize: 42, mb: 1 }} />
                        <Typography color="text.secondary">No hay alertas para los filtros seleccionados</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
          </>
        )}

        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={saving ? undefined : () => setDrawerOpen(false)}
          PaperProps={{ sx: { width: { xs: '100%', sm: 620 }, maxWidth: '100%' } }}
        >
          <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                  {item.id ? 'Editar alerta' : 'Nueva alerta'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {getTypeLabel(item.type)}
                </Typography>
              </Box>
              <IconButton onClick={() => setDrawerOpen(false)} disabled={saving}>
                <CloseIcon />
              </IconButton>
            </Stack>
            {saveError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError('')}>
                {saveError}
              </Alert>
            )}
            <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
              {steps.map((step) => (
                <Step key={step}>
                  <StepLabel>{step}</StepLabel>
                </Step>
              ))}
            </Stepper>
            <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>{renderFormStep()}</Box>
            <Divider sx={{ my: 2 }} />
            <Stack direction="row" spacing={1} justifyContent="space-between">
              <Button disabled={activeStep === 0 || saving} onClick={() => setActiveStep((step) => step - 1)}>
                Atras
              </Button>
              <Stack direction="row" spacing={1}>
                {activeStep < steps.length - 1 ? (
                  <Button variant="contained" onClick={() => setActiveStep((step) => step + 1)}>
                    Siguiente
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                    disabled={saving || !formValid}
                    onClick={handleSave}
                    sx={{ bgcolor: eliteGreen }}
                  >
                    Guardar
                  </Button>
                )}
              </Stack>
            </Stack>
          </Box>
        </Drawer>

        <Drawer
          anchor="right"
          open={Boolean(selectedEventDetail) && activeTab !== 2 && (compactDetail || activeTab === 1)}
          onClose={() => setSelectedEvent(null)}
          PaperProps={{ sx: { width: { xs: '100%', sm: 460 }, maxWidth: '100%', p: 2.5 } }}
        >
          {selectedEventDetail && renderEventDetail(selectedEventDetail)}
        </Drawer>

        <Dialog
          open={Boolean(alertToDelete)}
          onClose={deletingAlert ? undefined : () => setAlertToDelete(null)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Confirmar eliminacion</DialogTitle>
          <DialogContent>
            <Typography color="text.secondary">
              Esta accion eliminara permanentemente la alerta seleccionada.
            </Typography>
            <Typography sx={{ mt: 1, fontWeight: 800 }}>{alertToDelete?.name}</Typography>
          </DialogContent>
          <DialogActions>
            <Button disabled={deletingAlert} onClick={() => setAlertToDelete(null)}>
              Cancelar
            </Button>
            <Button
              color="error"
              variant="contained"
              disabled={deletingAlert}
              startIcon={deletingAlert ? <CircularProgress size={16} color="inherit" /> : <DeleteForeverIcon />}
              onClick={handleConfirmDelete}
            >
              Eliminar
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PageLayout>
  );
};

export default MonitoringAlertsPage;

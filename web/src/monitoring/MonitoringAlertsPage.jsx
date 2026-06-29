import { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  CircularProgress,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';

import PageLayout from '../common/components/PageLayout';
import MonitoringMenu from './MonitoringMenu';
import fetchOrThrow from '../common/util/fetchOrThrow';

const emptyAlert = {
  type: 'Velocidad',
  name: '',
  speedLimit: 90,
  active: true,
  deviceIds: [],
  vehicleGroupIds: [],
  geofenceIds: [],
  geofenceGroupIds: [],
};

const optionKey = (option) => `${option.kind}:${option.id}`;

const fieldSx = {
  '& .MuiInputBase-root': {
    minHeight: 42,
    borderRadius: 1.5,
    fontSize: 14,
  },
  '& .MuiInputBase-input': {
    py: 1.1,
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'divider',
  },
  '& .MuiInputBase-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderWidth: 1,
  },
};

const autocompleteSx = {
  ...fieldSx,
  '& .MuiAutocomplete-inputRoot': {
    minHeight: 42,
    alignItems: 'flex-start',
    py: 0.25,
    gap: 0.5,
  },
  '& .MuiChip-root': {
    height: 24,
    borderRadius: 1,
    maxWidth: 160,
    fontWeight: 600,
  },
  '& .MuiChip-label': {
    px: 1,
  },
  '& .MuiAutocomplete-input': {
    minWidth: '90px !important',
  },
};

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

const MonitoringAlertsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [geofenceFolders, setGeofenceFolders] = useState([]);
  const [item, setItem] = useState(emptyAlert);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [alertToDelete, setAlertToDelete] = useState(null);
  const [deletingAlert, setDeletingAlert] = useState(false);

  const vehicleOptions = useMemo(() => [
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
  ], [devices, groups]);

  const geofenceOptions = useMemo(() => [
    ...geofenceFolders.map((folder) => ({
      id: folder.id,
      kind: 'folder',
      group: 'Carpetas de geocercas',
      label: folder.name,
    })),
    ...geofences.map((geofence) => ({
      id: geofence.id,
      kind: 'geofence',
      group: 'Geocercas',
      label: geofence.name,
    })),
  ], [geofences, geofenceFolders]);

  const selectedVehicleOptions = useMemo(() => vehicleOptions.filter((option) => (
    option.kind === 'device'
      ? item.deviceIds.includes(option.id)
      : item.vehicleGroupIds.includes(option.id)
  )), [item.deviceIds, item.vehicleGroupIds, vehicleOptions]);

  const selectedGeofenceOptions = useMemo(() => geofenceOptions.filter((option) => (
    option.kind === 'geofence'
      ? item.geofenceIds.includes(option.id)
      : item.geofenceGroupIds.includes(option.id)
  )), [item.geofenceIds, item.geofenceGroupIds, geofenceOptions]);

  const loadData = async () => {
    const [
      alertsData,
      devicesData,
      groupsData,
      geofencesData,
      foldersData,
    ] = await Promise.all([
      loadJson('/api/alerts'),
      loadJson(['/api/devices?all=true', '/api/devices'], true),
      loadJson(['/api/groups?all=true', '/api/groups'], true),
      loadJson(['/api/geofences?all=true', '/api/geofences'], true),
      loadJson(['/api/geofenceFolders?all=true', '/api/geofenceFolders'], true),
    ]);

    setAlerts(alertsData);
    setDevices(devicesData);
    setGroups(groupsData);
    setGeofences(geofencesData);
    setGeofenceFolders(foldersData);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVehicleChange = (_, selected) => {
    setItem((current) => ({
      ...current,
      deviceIds: selected.filter((option) => option.kind === 'device').map((option) => option.id),
      vehicleGroupIds: selected.filter((option) => option.kind === 'group').map((option) => option.id),
    }));
  };

  const handleGeofenceChange = (_, selected) => {
    setItem((current) => ({
      ...current,
      geofenceIds: selected.filter((option) => option.kind === 'geofence').map((option) => option.id),
      geofenceGroupIds: selected.filter((option) => option.kind === 'folder').map((option) => option.id),
    }));
  };

  const handleEdit = (alert) => {
    setItem({
      ...emptyAlert,
      ...alert,
      deviceIds: alert.deviceIds || [],
      vehicleGroupIds: alert.vehicleGroupIds || [],
      geofenceIds: alert.geofenceIds || [],
      geofenceGroupIds: alert.geofenceGroupIds || [],
    });
  };

  const handleReset = () => setItem(emptyAlert);

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      const payload = {
        ...item,
        type: 'Velocidad',
        speedLimit: Number(item.speedLimit),
      };
      const url = item.id ? `/api/alerts/${item.id}` : '/api/alerts';
      const method = item.id ? 'PUT' : 'POST';
      const response = await fetchOrThrow(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const saved = await response.json();
      setAlerts((current) => [
        saved,
        ...current.filter((alert) => alert.id !== saved.id),
      ]);
      setItem(emptyAlert);
      await loadData();
      setSaveSuccess(true);
    } catch (error) {
      setSaveError(error.message || 'No se pudo guardar la alerta');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (alert) => {
    setAlertToDelete(alert);
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

  const renderOption = (props, option, { selected }) => (
    <li key={optionKey(option)} {...props}>
      <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
      <Box>
        <Typography variant="body2">{option.label}</Typography>
        <Typography variant="caption" color="text.secondary">
          {option.kind === 'device' ? 'Vehiculo individual' : option.kind === 'group' ? 'Flota' : option.kind === 'geofence' ? 'Geocerca individual' : 'Grupo de geocercas'}
        </Typography>
      </Box>
    </li>
  );

  return (
    <PageLayout menu={<MonitoringMenu />} breadcrumbs={['Monitoreo', 'Alertas']}>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Snackbar
          open={saveSuccess}
          autoHideDuration={3500}
          onClose={() => setSaveSuccess(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setSaveSuccess(false)}
            severity="success"
            variant="filled"
            sx={{ width: '100%', boxShadow: 3 }}
          >
            Alerta guardada correctamente
          </Alert>
        </Snackbar>
        <Dialog
          open={Boolean(alertToDelete)}
          onClose={deletingAlert ? undefined : () => setAlertToDelete(null)}
          fullWidth
          maxWidth="xs"
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: '0 18px 60px rgba(15, 23, 42, 0.22)',
            },
          }}
        >
          <DialogTitle sx={{ pb: 0.5, fontWeight: 700 }}>
            Confirmar eliminacion
          </DialogTitle>
          <DialogContent sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Esta accion eliminara permanentemente la alerta seleccionada:
            </Typography>
            <Box
              sx={{
                mt: 1.5,
                px: 1.5,
                py: 1,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'action.hover',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {alertToDelete?.name || 'Alerta sin nombre'}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              Esta accion no se puede deshacer.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
            <Button
              variant="outlined"
              disabled={deletingAlert}
              onClick={() => setAlertToDelete(null)}
            >
              Cancelar
            </Button>
            <Button
              color="error"
              variant="contained"
              disabled={deletingAlert}
              startIcon={deletingAlert ? <CircularProgress size={16} color="inherit" /> : <DeleteForeverIcon />}
              onClick={handleConfirmDelete}
            >
              {deletingAlert ? 'Eliminando' : 'Eliminar alerta'}
            </Button>
          </DialogActions>
        </Dialog>
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ flex: 1 }}>
              {item.id ? 'Editar alerta' : 'Nueva alerta'}
            </Typography>
            <Button startIcon={<AddIcon />} onClick={handleReset}>
              Nueva
            </Button>
          </Stack>
          {saveError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {saveError}
            </Alert>
          )}

          <Stack spacing={2}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                gap: 2,
                alignItems: 'start',
              }}
            >
              <FormControl fullWidth size="small" sx={fieldSx}>
                <InputLabel>Tipo de alerta</InputLabel>
                <Select
                  label="Tipo de alerta"
                  value={item.type}
                  onChange={(event) => setItem({ ...item, type: event.target.value })}
                >
                  <MenuItem value="Velocidad">Velocidad</MenuItem>
                </Select>
              </FormControl>

              <TextField
                size="small"
                fullWidth
                label="Nombre de la alerta"
                value={item.name}
                onChange={(event) => setItem({ ...item, name: event.target.value })}
                sx={fieldSx}
              />

              <TextField
                size="small"
                fullWidth
                type="number"
                label="Limite km/h"
                value={item.speedLimit}
                onChange={(event) => setItem({ ...item, speedLimit: event.target.value })}
                sx={fieldSx}
              />
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                gap: 2,
                alignItems: 'start',
              }}
            >
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
                sx={autocompleteSx}
                renderInput={(params) => (
                  <TextField {...params} size="small" label="Vehiculos y flotas" placeholder="Buscar placa o flota" />
                )}
              />

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
                sx={autocompleteSx}
                renderInput={(params) => (
                  <TextField {...params} size="small" label="Geocercas y grupos" placeholder="Buscar geocerca o carpeta" />
                )}
              />

              <Box
                sx={{
                  minHeight: 42,
                  display: 'flex',
                  justifyContent: { xs: 'flex-start', md: 'flex-end' },
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <FormControlLabel
                  sx={{
                    m: 0,
                    height: 42,
                    whiteSpace: 'nowrap',
                    '& .MuiFormControlLabel-label': { fontSize: 14 },
                  }}
                  control={(
                    <Checkbox
                      checked={item.active}
                      onChange={(event) => setItem({ ...item, active: event.target.checked })}
                    />
                  )}
                  label="Activa"
                />
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={saving || !item.name || !item.speedLimit}
                  onClick={handleSave}
                  sx={{
                    height: 42,
                    minWidth: 150,
                    borderRadius: 1.5,
                    fontWeight: 700,
                  }}
                >
                  Guardar
                </Button>
              </Box>
            </Box>
          </Stack>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Alertas configuradas
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Limite</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Vehiculos / flotas</TableCell>
                  <TableCell>Geocercas / grupos</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id} hover>
                    <TableCell>{alert.name}</TableCell>
                    <TableCell>{alert.type}</TableCell>
                    <TableCell>{alert.speedLimit} km/h</TableCell>
                    <TableCell>
                      <Chip size="small" label={alert.active ? 'Activa' : 'Inactiva'} color={alert.active ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell>
                      {(alert.deviceIds?.length || 0) + (alert.vehicleGroupIds?.length || 0)}
                    </TableCell>
                    <TableCell>
                      {(alert.geofenceIds?.length || 0) + (alert.geofenceGroupIds?.length || 0)}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Editar alerta">
                          <IconButton size="small" color="primary" onClick={() => handleEdit(alert)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar alerta">
                          <IconButton size="small" color="error" onClick={() => handleDelete(alert)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </PageLayout>
  );
};

export default MonitoringAlertsPage;

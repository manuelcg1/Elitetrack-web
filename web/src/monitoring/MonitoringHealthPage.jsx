import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import {
  Avatar,
  
  LinearProgress,
  
  
} from '@mui/material';

import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import WrongLocationIcon from '@mui/icons-material/WrongLocation';
import BatteryAlertIcon from '@mui/icons-material/BatteryAlert';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';

import FileDownloadIcon from '@mui/icons-material/FileDownload';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import PageLayout from '../common/components/PageLayout';
import MonitoringMenu from './MonitoringMenu';
import fetchOrThrow from '../common/util/fetchOrThrow';

const REFRESH_INTERVAL = 30000;

const HealthCard = ({
  title,
  value,
  icon,
  color = 'primary',
  total,
}) => {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 4,
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        background: (theme) => `linear-gradient(135deg, ${theme.palette.background.paper}, ${theme.palette.action.hover})`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar
          sx={{
            bgcolor: `${color}.light`,
            color: `${color}.dark`,
            width: 42,
            height: 42,
          }}
        >
          {icon}
        </Avatar>

        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>

          <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
            {value}
          </Typography>
        </Box>
      </Box>

      {typeof total === 'number' && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress
            variant="determinate"
            value={percentage}
            color={color}
            sx={{ height: 7, borderRadius: 10 }}
          />

          <Typography variant="caption" color="text.secondary">
            {percentage}% del total
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

const severityColor = (severity) => {
  switch (severity) {
    case 'critical':
      return 'error';
    case 'warning':
      return 'warning';
    case 'ok':
      return 'success';
    default:
      return 'default';
  }
};

const severityLabel = (severity) => {
  switch (severity) {
    case 'critical':
      return 'Crítico';
    case 'warning':
      return 'Advertencia';
    case 'ok':
      return 'OK';
    default:
      return 'Desconocido';
  }
};

const formatDate = (value) => {
  if (!value) return 'Sin datos';
  return new Date(value).toLocaleString();
};

const formatMinutes = (minutes) => {
  if (minutes == null) return 'Nunca reportó';
  if (minutes < 1) return 'Hace menos de 1 min';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `Hace ${hours} h ${rest} min` : `Hace ${hours} h`;
};

const MonitoringHealthPage = () => {
  const [summary, setSummary] = useState(null);
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const [summaryResponse, devicesResponse] = await Promise.all([
      fetchOrThrow('/api/health/summary'),
      fetchOrThrow('/api/health/devices'),
    ]);

    setSummary(await summaryResponse.json());
    setDevices(await devicesResponse.json());
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const filteredDevices = useMemo(() => devices.filter((device) => {
    const text = `${device.name || ''} ${device.uniqueId || ''} ${device.issue || ''}`.toLowerCase();
    const matchesSearch = text.includes(search.toLowerCase());

    const matchesFilter = filter === 'all'
      || (filter === 'online' && device.online)
      || (filter === 'offline' && !device.online)
      || (filter === 'noReport' && device.noReport)
      || (filter === 'invalidPosition' && device.invalidPosition)
      || (filter === 'lowBattery' && device.lowBattery);

    return matchesSearch && matchesFilter;
  }), [devices, search, filter]);

  const handleExportExcel = () => {
    const headers = [
      'Dispositivo',
      'IMEI / ID',
      'Estado',
      'Severidad',
      'Último reporte',
      'Minutos sin reporte',
      'Batería',
      'Incidencia',
    ];

    const rows = filteredDevices.map((device) => [
      device.name || '',
      device.uniqueId || '',
      device.online ? 'Online' : 'Offline',
      severityLabel(device.severity),
      formatDate(device.lastUpdate),
      device.minutesSinceLastUpdate ?? '',
      device.batteryLevel != null ? `${device.batteryLevel}%` : 'N/D',
      device.issue || 'OK',
    ]);

    const csvContent = [
      headers,
      ...rows,
    ].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n');

    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `salud-gps-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <PageLayout
      menu={<MonitoringMenu />}
      breadcrumbs={['Monitoreo', 'Salud GPS']}
    >
      <Box sx={{ p: 3 }}>
        {loading || !summary ? (
          <CircularProgress />
        ) : (
          <>


            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={2}>
                <HealthCard title="Total GPS" value={summary.total} icon={<GpsFixedIcon />} total={summary.total} />
              </Grid>
              <Grid item xs={12} md={2}>
                <HealthCard title="Online" value={summary.online} icon={<CheckCircleIcon />} color="success" total={summary.total} />
              </Grid>
              <Grid item xs={12} md={2}>
                <HealthCard title="Offline" value={summary.offline} icon={<CloudOffIcon />} total={summary.total} />
              </Grid>
              <Grid item xs={12} md={2}>
                <HealthCard title="Sin reporte" value={summary.noReport} icon={<ReportProblemIcon />} color="warning" total={summary.total} />
              </Grid>
              <Grid item xs={12} md={2}>
                <HealthCard title="Posición inválida" value={summary.invalidPosition} icon={<WrongLocationIcon />} color="error" total={summary.total} />
              </Grid>
              <Grid item xs={12} md={2}>
                <HealthCard title="Batería baja" value={summary.lowBattery} icon={<BatteryAlertIcon />} color="error" total={summary.total} />
              </Grid>
            </Grid>

            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="Buscar dispositivo"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />

                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Filtro</InputLabel>
                  <Select
                    label="Filtro"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  >
                    <MenuItem value="all">Todos</MenuItem>
                    <MenuItem value="online">Online</MenuItem>
                    <MenuItem value="offline">Offline</MenuItem>
                    <MenuItem value="noReport">Sin reporte</MenuItem>
                    <MenuItem value="invalidPosition">Posición inválida</MenuItem>
                    <MenuItem value="lowBattery">Batería baja</MenuItem>
                  </Select>
                </FormControl>

                <Tooltip title="Descargar Excel">
                  <IconButton color="primary" onClick={handleExportExcel}>
                    <CloudDownloadIcon />
                  </IconButton>
                </Tooltip>
              </Stack>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Dispositivo</TableCell>
                      <TableCell>IMEI / ID</TableCell>
                      <TableCell>Estado</TableCell>
                      <TableCell>Severidad</TableCell>
                      <TableCell>Último reporte</TableCell>
                      <TableCell>Batería</TableCell>
                      <TableCell>Incidencia</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {filteredDevices.map((device) => (
                      <TableRow key={device.deviceId} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {device.name}
                          </Typography>
                        </TableCell>

                        <TableCell>{device.uniqueId}</TableCell>

                        <TableCell>
                          <Chip
                            size="small"
                            label={device.online ? 'Online' : 'Offline'}
                            color={device.online ? 'success' : 'default'}
                          />
                        </TableCell>

                        <TableCell>
                          <Chip
                            size="small"
                            label={severityLabel(device.severity)}
                            color={severityColor(device.severity)}
                          />
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2">
                            {formatMinutes(device.minutesSinceLastUpdate)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(device.lastUpdate)}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          {device.batteryLevel != null ? `${device.batteryLevel}%` : 'N/D'}
                        </TableCell>

                        <TableCell>
                          <Chip
                            size="small"
                            label={device.issue || 'OK'}
                            color={severityColor(device.severity)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}

                    {!filteredDevices.length && (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <Typography align="center" color="text.secondary" sx={{ py: 3 }}>
                            No se encontraron dispositivos.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </>
        )}
      </Box>
    </PageLayout>
  );
};

export default MonitoringHealthPage;
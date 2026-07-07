import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Checkbox,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import DataObjectIcon from '@mui/icons-material/DataObject';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from './components/SettingsMenu';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { useManager } from '../common/util/permissions';

const DeviceForwardServersPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const manager = useManager();
  const storeDevice = useSelector((state) => state.devices.items[id]);
  const [device, setDevice] = useState(null);
  const [servers, setServers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const displayDevice = storeDevice || device;

  useEffect(() => {
    const loadData = async () => {
      const [deviceResponse, serversResponse, assignedResponse] = await Promise.all([
        fetchOrThrow(`/api/devices/${id}`),
        fetchOrThrow('/api/forward/servers'),
        fetchOrThrow(`/api/forward/devices/${id}/servers`),
      ]);
      setDevice(await deviceResponse.json());
      setServers(await serversResponse.json());
      const assigned = await assignedResponse.json();
      setSelectedIds(assigned.map((item) => item.serverId));
    };
    loadData();
  }, [id]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleServer = (serverId) => {
    setSelectedIds((previous) =>
      previous.includes(serverId)
        ? previous.filter((item) => item !== serverId)
        : [...previous, serverId],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchOrThrow(`/api/forward/devices/${id}/servers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedIds),
      });
      navigate('/settings/devices', {
        state: {
          snackbarMessage: `Servidores actualizados para ${displayDevice?.name || 'el dispositivo'}`,
        },
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'deviceTitle', 'Servidor']}>
      <Box sx={{ p: 2, maxWidth: 720, mx: 'auto', width: '100%' }}>
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ p: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <SmartphoneIcon color="primary" />
              <Box>
                <Typography variant="h6">
                  {displayDevice?.name || 'Cargando dispositivo'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  IMEI {displayDevice?.uniqueId || id}
                </Typography>
              </Box>
            </Stack>
          </Box>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <DataObjectIcon color="primary" />
              <Typography fontWeight={700}>Reenvio de posicion (JSON)</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Destinos asignados
            </Typography>
            <List disablePadding>
              {servers.map((server) => (
                <ListItem key={server.id} disablePadding sx={{ mb: 1 }}>
                  <ListItemButton
                    onClick={() => toggleServer(server.id)}
                    disabled={!manager}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      py: 0.5,
                    }}
                  >
                    <Checkbox
                      checked={selectedSet.has(server.id)}
                      tabIndex={-1}
                      disableRipple
                      size="small"
                    />
                    <ListItemText
                      primary={<Typography fontWeight={700}>{server.name}</Typography>}
                      secondary={server.ipDominio}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
            <Typography variant="caption" color="text.secondary">
              Este GPS reenviara sus posiciones a los destinos marcados.
            </Typography>
          </Box>
          <Divider />
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" onClick={handleSave} disabled={saving || !manager}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </PageLayout>
  );
};

export default DeviceForwardServersPage;

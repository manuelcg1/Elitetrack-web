import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DnsIcon from '@mui/icons-material/Dns';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SensorsIcon from '@mui/icons-material/Sensors';
import PageLayout from '../../common/components/PageLayout';
import MonitoringMenu from '../MonitoringMenu';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import ForwardServerDialog from './ForwardServerDialog';

const ForwarderPage = () => {
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);

  const [servers, setServers] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const loadData = async () => {
    const serversResponse = await fetchOrThrow('/api/forward/servers');
    const nextServers = await serversResponse.json();
    const nextAssignments = {};
    await Promise.all(nextServers.map(async (server) => {
      const response = await fetchOrThrow(`/api/forward/servers/${server.id}/devices`);
      nextAssignments[server.id] = await response.json();
    }));
    setServers(nextServers);
    setAssignments(nextAssignments);
  };

  useEffect(() => {
    loadData();
  }, []);

  const counts = useMemo(() => Object.fromEntries(
    servers.map((server) => [server.id, assignments[server.id]?.length || 0]),
  ), [servers, assignments]);

  const handleNew = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const handleEdit = (server) => {
    setEditingItem(server);
    setDialogOpen(true);
  };

  const handleDelete = (server) => {
    setDeleteItem(server);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await fetchOrThrow(`/api/forward/servers/${deleteItem.id}`, { method: 'DELETE' });
      await loadData();
      setSnackbarMessage(`Destino "${deleteItem.name}" eliminado correctamente`);
      setDeleteItem(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async (server) => {
    const isUpdate = Boolean(server.id);
    const method = server.id ? 'PUT' : 'POST';
    const url = server.id ? `/api/forward/servers/${server.id}` : '/api/forward/servers';
    const response = await fetchOrThrow(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(server),
    });
    const savedServer = await response.json();
    setDialogOpen(false);
    setServers((previous) => (
      server.id
        ? previous.map((item) => (item.id === savedServer.id ? savedServer : item))
        : [...previous, savedServer]
    ));
    await loadData();
    setSnackbarMessage(
      isUpdate
        ? `Destino "${savedServer.name}" actualizado correctamente`
        : `Destino "${savedServer.name}" creado correctamente`,
    );
  };

  const getServerDevices = (serverId) => (assignments[serverId] || [])
    .map((assignment) => devices[assignment.deviceId])
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageLayout menu={<MonitoringMenu />} breadcrumbs={['monitoringTitle', 'Retransmision']}>
      <Box sx={{ p: 2, maxWidth: 980, mx: 'auto', width: '100%' }}>
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Box
            sx={{
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <DnsIcon color="primary" />
              <Box>
                <Typography variant="h6">Destinos de reenvio JSON</Typography>
                <Typography variant="body2" color="text.secondary">
                  Configura cada servidor una sola vez y asignalo a tus dispositivos.
                </Typography>
              </Box>
            </Stack>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleNew}>
              Nuevo destino
            </Button>
          </Box>

          <List disablePadding>
            {servers.map((server) => {
              const open = expandedId === server.id;
              const serverDevices = getServerDevices(server.id);
              return (
                <Box key={server.id}>
                  <ListItem
                    secondaryAction={(
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={`${counts[server.id]} dispositivos`}
                          color="primary"
                          variant="outlined"
                          size="small"
                        />
                        <Tooltip title="Editar">
                          <IconButton edge="end" onClick={() => handleEdit(server)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar">
                          <IconButton edge="end" onClick={() => handleDelete(server)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={open ? 'Ocultar GPS' : 'Ver GPS'}>
                          <IconButton edge="end" onClick={() => setExpandedId(open ? null : server.id)}>
                            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    )}
                    sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: server.active ? 'success.main' : 'error.main',
                        mr: 2,
                      }}
                    />
                    <ListItemText
                      primary={<Typography fontWeight={700}>{server.name}</Typography>}
                      secondary={`${server.ipDominio} - usuario ${server.username || 'sin usuario'}`}
                    />
                  </ListItem>
                  <Collapse in={open} timeout="auto" unmountOnExit>
                    <Box sx={{ bgcolor: 'action.hover', px: 3, py: 2 }}>
                      {serverDevices.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          Sin GPS asignados a este destino.
                        </Typography>
                      ) : (
                        <Stack spacing={1}>
                          {serverDevices.map((device) => {
                            const position = positions[device.id];
                            return (
                              <Paper key={device.id} variant="outlined" sx={{ p: 1.25, borderRadius: 1 }}>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                  <SensorsIcon color={position ? 'success' : 'disabled'} fontSize="small" />
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" fontWeight={700} noWrap>
                                      {device.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" noWrap>
                                      IMEI {device.uniqueId}
                                    </Typography>
                                  </Box>
                                  <Chip
                                    size="small"
                                    color={position ? 'success' : 'default'}
                                    label={position ? 'Recibiendo' : 'Sin posicion'}
                                  />
                                </Stack>
                              </Paper>
                            );
                          })}
                        </Stack>
                      )}
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </List>
        </Paper>
      </Box>
      <ForwardServerDialog
        open={dialogOpen}
        item={editingItem}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
      <Dialog open={Boolean(deleteItem)} onClose={() => !deleting && setDeleteItem(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar destino</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Se eliminara "{deleteItem?.name}" del catalogo de retransmision. Los dispositivos asignados dejaran de
            reenviar posiciones a este destino.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteItem(null)} disabled={deleting}>
            Cancelar
          </Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={deleting}>
            {deleting ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={4000}
        onClose={() => setSnackbarMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSnackbarMessage('')}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </PageLayout>
  );
};

export default ForwarderPage;

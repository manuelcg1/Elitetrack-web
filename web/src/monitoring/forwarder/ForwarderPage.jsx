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
import { formatTime } from '../../common/util/formatter';
import ForwardServerDialog from './ForwardServerDialog';
import { useManager } from '../../common/util/permissions';

const ForwarderPage = () => {
  const manager = useManager();
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
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const loadData = async (isActive = () => true) => {
    const timestamp = Date.now();
    const requestOptions = { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } };
    const serversResponse = await fetchOrThrow(
      `/api/forward/servers?_ts=${timestamp}`,
      requestOptions,
    );
    const nextServers = await serversResponse.json();
    const nextAssignments = {};
    await Promise.all(
      nextServers.map(async (server) => {
        const response = await fetchOrThrow(
          `/api/forward/servers/${server.id}/devices?_ts=${timestamp}`,
          requestOptions,
        );
        const serverAssignments = await response.json();
        nextAssignments[server.id] = Array.from(
          new Map(
            serverAssignments.map((assignment) => [assignment.deviceId, assignment]),
          ).values(),
        );
      }),
    );
    if (isActive()) {
      setServers(nextServers);
      setAssignments(nextAssignments);
    }
  };

  useEffect(() => {
    let active = true;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) {
        return;
      }
      refreshing = true;
      try {
        await loadData(() => active);
      } catch {
        if (active) {
          setSnackbarSeverity('error');
          setSnackbarMessage('No se pudo actualizar');
        }
      } finally {
        refreshing = false;
      }
    };
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const counts = useMemo(
    () =>
      Object.fromEntries(servers.map((server) => [server.id, assignments[server.id]?.length || 0])),
    [servers, assignments],
  );

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
      setSnackbarSeverity('success');
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
    setServers((previous) =>
      server.id
        ? previous.map((item) => (item.id === savedServer.id ? savedServer : item))
        : [...previous, savedServer],
    );
    await loadData();
    setSnackbarSeverity('success');
    setSnackbarMessage(
      isUpdate
        ? `Destino "${savedServer.name}" actualizado correctamente`
        : `Destino "${savedServer.name}" creado correctamente`,
    );
  };

  const getServerDevices = (serverId) =>
    (assignments[serverId] || [])
      .map((assignment) => ({
        assignment,
        device: devices[assignment.deviceId],
      }))
      .filter(({ device }) => device)
      .sort((a, b) => a.device.name.localeCompare(b.device.name));

  return (
    <PageLayout menu={<MonitoringMenu />} breadcrumbs={['Retransmision']}>
      <Box
        sx={{
          p: { xs: 1.5, sm: 2 },
          maxWidth: 980,
          mx: 'auto',
          width: '100%',
        }}
      >
        <Paper
          variant="outlined"
          sx={{
            borderRadius: { xs: 3, sm: 2 },
            overflow: 'hidden',
            boxShadow: { xs: '0 14px 34px rgba(15, 23, 42, 0.08)', sm: 'none' },
          }}
        >
          <Box
            sx={{
              p: { xs: 1.5, sm: 2 },
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: { xs: 1.5, sm: 2 },
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack
              direction="row"
              spacing={1.25}
              alignItems="flex-start"
              sx={{ width: '100%', minWidth: 0 }}
            >
              <DnsIcon color="primary" />
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="h6"
                  sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, lineHeight: 1.25 }}
                >
                  Destinos de reenvio JSON
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Configura cada servidor una sola vez y asignalo a tus dispositivos.
                </Typography>
              </Box>
            </Stack>
            {manager && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleNew}
                sx={{
                  alignSelf: { xs: 'stretch', sm: 'center' },
                  minWidth: { sm: 154 },
                  whiteSpace: 'nowrap',
                }}
              >
                Nuevo destino
              </Button>
            )}
          </Box>

          <List disablePadding>
            {servers.map((server) => {
              const open = expandedId === server.id;
              const serverDevices = getServerDevices(server.id);
              return (
                <Box key={server.id}>
                  <Box
                    sx={{
                      px: { xs: 1.5, sm: 2 },
                      py: { xs: 1.25, sm: 1.5 },
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={{ xs: 1, sm: 2 }}
                      alignItems={{ xs: 'stretch', sm: 'center' }}
                    >
                      <Stack
                        direction="row"
                        spacing={1.5}
                        alignItems="flex-start"
                        sx={{ minWidth: 0, flex: 1 }}
                      >
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: server.active ? 'success.main' : 'error.main',
                            mt: 0.75,
                            flex: '0 0 auto',
                          }}
                        />
                        <ListItemText
                          sx={{ m: 0, minWidth: 0 }}
                          primary={
                            <Typography fontWeight={700} noWrap>
                              {server.name}
                            </Typography>
                          }
                          secondary={
                            <Typography
                              component="span"
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: 'block',
                                lineHeight: 1.35,
                                overflowWrap: 'anywhere',
                              }}
                            >
                              {[
                                server.ipDominio,
                                `usuario ${server.username || 'sin usuario'}`,
                                server.apiKey ? 'API key configurada' : 'sin API key',
                              ].join(' - ')}
                            </Typography>
                          }
                        />
                      </Stack>
                      <Stack
                        direction="row"
                        spacing={0.75}
                        alignItems="center"
                        justifyContent={{ xs: 'space-between', sm: 'flex-end' }}
                        sx={{ flexWrap: 'wrap', rowGap: 0.75 }}
                      >
                        <Chip
                          label={`${counts[server.id]} dispositivos`}
                          color="primary"
                          variant="outlined"
                          size="small"
                          sx={{ mr: { xs: 'auto', sm: 0 } }}
                        />
                        {manager && (
                          <>
                            <Tooltip title="Editar">
                              <IconButton size="small" onClick={() => handleEdit(server)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Eliminar">
                              <IconButton size="small" onClick={() => handleDelete(server)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        <Tooltip title={open ? 'Ocultar GPS' : 'Ver GPS'}>
                          <IconButton
                            size="small"
                            onClick={() => setExpandedId(open ? null : server.id)}
                          >
                            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Box>
                  <Collapse in={open} timeout="auto" unmountOnExit>
                    <Box
                      sx={{
                        bgcolor: 'action.hover',
                        px: { xs: 1.5, sm: 3 },
                        py: { xs: 1.5, sm: 2 },
                      }}
                    >
                      {serverDevices.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          Sin GPS asignados a este destino.
                        </Typography>
                      ) : (
                        <Stack spacing={1}>
                          {serverDevices.map(({ assignment, device }) => {
                            const position = positions[device.id];
                            const lastSentLabel = assignment.lastSent
                              ? formatTime(assignment.lastSent, 'seconds')
                              : null;
                            const lastSentTime = assignment.lastSent
                              ? new Date(assignment.lastSent).getTime()
                              : null;
                            const isReceiving =
                              lastSentTime !== null &&
                              Number.isFinite(lastSentTime) &&
                              Date.now() - lastSentTime <= 5 * 60 * 1000;
                            const forwardingStatus = !assignment.lastSent
                              ? { label: 'Sin envío', color: 'default' }
                              : isReceiving
                                ? { label: 'Recibiendo', color: 'success' }
                                : { label: 'Sin señal', color: 'warning' };
                            return (
                              <Paper
                                key={device.id}
                                variant="outlined"
                                sx={{ p: { xs: 1, sm: 1.25 }, borderRadius: 1.5 }}
                              >
                                <Stack
                                  direction={{ xs: 'column', sm: 'row' }}
                                  spacing={{ xs: 1, sm: 1.5 }}
                                  alignItems={{ xs: 'stretch', sm: 'center' }}
                                >
                                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                                    <SensorsIcon
                                      color={position ? 'success' : 'disabled'}
                                      fontSize="small"
                                    />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Typography variant="body2" fontWeight={700} noWrap>
                                        {device.name}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" noWrap>
                                        IMEI {device.uniqueId}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" noWrap>
                                        Ultimo envio {lastSentLabel || 'sin registros'}
                                      </Typography>
                                    </Box>
                                  </Stack>
                                  <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                    justifyContent={{ xs: 'flex-end', sm: 'center' }}
                                    sx={{ flexWrap: 'wrap', rowGap: 0.75 }}
                                  >
                                    <Chip
                                      size="small"
                                      color={forwardingStatus.color}
                                      label={forwardingStatus.label}
                                    />
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      color={lastSentLabel ? 'primary' : 'default'}
                                      label={lastSentLabel || 'Sin envios'}
                                    />
                                  </Stack>
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
      <Dialog
        open={Boolean(deleteItem)}
        onClose={() => !deleting && setDeleteItem(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Eliminar destino</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Se eliminara "{deleteItem?.name}" del catalogo de retransmision. Los dispositivos
            asignados dejaran de reenviar posiciones a este destino.
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
        <Alert severity={snackbarSeverity} variant="filled" onClose={() => setSnackbarMessage('')}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </PageLayout>
  );
};

export default ForwarderPage;

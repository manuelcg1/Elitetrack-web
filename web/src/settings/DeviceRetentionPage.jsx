import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import EditIcon from '@mui/icons-material/Edit';
import PreviewIcon from '@mui/icons-material/Preview';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from './components/SettingsMenu';
import EliteTable, {
  EliteTableActionButton, EliteTablePrimaryText, EliteTableSecondaryText, EliteTableStatusChip,
} from '../common/components/EliteTable';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { useCatch } from '../reactHelper';

const DeviceRetentionPage = () => {
  const devices = useSelector((state) => state.devices.items);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [selected, setSelected] = useState([]);

  const load = useCatch(async () => {
    setLoading(true);
    const response = await fetchOrThrow('/api/retention/policies');
    setPolicies(await response.json());
    setLoading(false);
  });

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => Object.values(devices).map((device) => {
    const policy = policies.find((item) => item.deviceId === device.id);
    return policy || { deviceId: device.id, enabled: false, retentionDays: 60, lastStatus: 'NEVER_RUN' };
  }).filter((row) => {
    const device = devices[row.deviceId];
    const matchesSearch = `${device?.name} ${device?.uniqueId}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all'
      || filter === 'active' && row.enabled
      || filter === 'inactive' && !row.enabled
      || filter === 'error' && ['FAILED', 'PARTIAL'].includes(row.lastStatus)
      || filter === 'never' && (!row.lastStatus || row.lastStatus === 'NEVER_RUN');
    return matchesSearch && matchesFilter;
  }), [devices, policies, search, filter]);

  const save = useCatch(async () => {
    const bulk = editing.bulk;
    await fetchOrThrow(bulk ? '/api/retention/policies/bulk' : `/api/retention/policies/${editing.deviceId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(bulk ? { deviceIds: selected } : {}),
        enabled: editing.enabled, retentionDays: Number(editing.retentionDays),
      }),
    });
    setEditing(null);
    if (bulk) setSelected([]);
    await load();
  });

  const showPreview = useCatch(async (row) => {
    const response = await fetchOrThrow(`/api/retention/policies/${row.deviceId}/preview`, { method: 'POST' });
    setPreview(await response.json());
  });

  const run = useCatch(async () => {
    await fetchOrThrow(`/api/retention/policies/${confirm.deviceId}/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun: false }),
    });
    setConfirm(null);
    await load();
  });

  const columns = [
    { id: 'select', label: '', render: (r) => <Checkbox size="small"
      checked={selected.includes(r.deviceId)} onChange={(e) => setSelected((current) => e.target.checked
        ? [...current, r.deviceId] : current.filter((id) => id !== r.deviceId))} /> },
    { id: 'device', label: 'Dispositivo', sortable: true, sortValue: (r) => devices[r.deviceId]?.name,
      render: (r) => <><EliteTablePrimaryText>{devices[r.deviceId]?.name}</EliteTablePrimaryText>
        <EliteTableSecondaryText>{devices[r.deviceId]?.uniqueId}</EliteTableSecondaryText></> },
    { id: 'enabled', label: 'Estado', render: (r) => <EliteTableStatusChip
      label={r.enabled ? 'Activa' : 'Inactiva'} color={r.enabled ? 'success' : 'default'} /> },
    { id: 'retentionDays', label: 'Días', sortable: true },
    { id: 'lastCleanup', label: 'Última limpieza', hideOnMobile: true,
      render: (r) => r.lastCleanup ? new Date(r.lastCleanup).toLocaleString() : 'Nunca' },
    { id: 'lastStatus', label: 'Resultado', render: (r) => r.lastStatus || 'NEVER_RUN' },
    { id: 'actions', label: 'Acciones', render: (r) => <Stack direction="row" spacing={1}>
      <EliteTableActionButton label="Editar" onClick={() => setEditing({ ...r })}><EditIcon /></EliteTableActionButton>
      <EliteTableActionButton label="Vista previa" disabled={!policies.some((p) => p.deviceId === r.deviceId)}
        onClick={() => showPreview(r)}><PreviewIcon /></EliteTableActionButton>
      <EliteTableActionButton label="Ejecutar limpieza" color="error" disabled={!r.enabled}
        onClick={() => setConfirm(r)}><DeleteSweepIcon /></EliteTableActionButton>
    </Stack> },
  ];

  return <PageLayout menu={<SettingsMenu />} breadcrumbs={['Ajustes', 'Retención de datos']}>
    <Box sx={{ p: { xs: 2, md: 3 }, width: '100%', minWidth: 0 }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>Retención de datos GPS</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>Políticas independientes por dispositivo.</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField size="small" label="Buscar dispositivo" value={search}
          onChange={(e) => setSearch(e.target.value)} />
        <TextField select size="small" label="Filtro" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <MenuItem value="all">Todos</MenuItem><MenuItem value="active">Activos</MenuItem>
          <MenuItem value="inactive">Inactivos</MenuItem><MenuItem value="error">Con error</MenuItem>
          <MenuItem value="never">Nunca ejecutados</MenuItem>
        </TextField>
        <Button variant="outlined" disabled={!selected.length}
          onClick={() => setEditing({ bulk: true, enabled: true, retentionDays: 60 })}>
          Aplicar política ({selected.length})
        </Button>
      </Stack>
      <EliteTable columns={columns} rows={rows} getRowId={(r) => r.deviceId} loading={loading}
        rowsPerPageOptions={[10, 25, 50, 100]} minWidth={900} />
    </Box>
    <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
      <DialogTitle>Política de retención</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
        {editing?.bulk && <Typography>{selected.length} dispositivos seleccionados</Typography>}
        <Alert severity="warning">Las posiciones anteriores al período configurado se eliminarán permanentemente.
          Los eventos y alertas se conservarán.</Alert>
        <FormControlLabel control={<Checkbox checked={editing?.enabled || false}
          onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} />} label="Activar política" />
        <TextField type="number" label="Días de conservación" inputProps={{ min: 30, max: 3650 }}
          value={editing?.retentionDays || 60}
          onChange={(e) => setEditing({ ...editing, retentionDays: e.target.value })} />
      </Stack></DialogContent><DialogActions><Button onClick={() => setEditing(null)}>Cancelar</Button>
        <Button variant="contained" onClick={save}>Guardar política</Button></DialogActions></Dialog>
    <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} fullWidth maxWidth="sm">
      <DialogTitle>Vista previa</DialogTitle><DialogContent><Stack spacing={1}>
        <Typography>Fecha límite: {preview && new Date(preview.cutoff).toLocaleString()}</Typography>
        <Typography>Registros elegibles: {preview?.eligiblePositions?.toLocaleString()}</Typography>
        <Typography>Posición más antigua: {preview?.oldestPosition ? new Date(preview.oldestPosition).toLocaleString() : '-'}</Typography>
        <Typography>Posición actual protegida: {preview?.currentPositionId || '-'}</Typography>
      </Stack></DialogContent><DialogActions><Button onClick={() => setPreview(null)}>Cerrar</Button>
        <Button color="error" onClick={() => { setConfirm(preview); setPreview(null); }}>Ejecutar limpieza</Button>
      </DialogActions></Dialog>
    <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)}><DialogTitle>¿Ejecutar limpieza de posiciones?</DialogTitle>
      <DialogContent>Esta acción elimina permanentemente las posiciones antiguas y no se puede deshacer.</DialogContent>
      <DialogActions><Button onClick={() => setConfirm(null)}>Cancelar</Button>
        <Button color="error" variant="contained" onClick={run}>Confirmar limpieza</Button></DialogActions></Dialog>
  </PageLayout>;
};

export default DeviceRetentionPage;

import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';

const TARGET_STATUSES = [
  { value: 'en_almacen', label: 'En almacén' },
  { value: 'desinstalado', label: 'Desinstalado' },
  { value: 'en_revision', label: 'En revisión' },
  { value: 'danado', label: 'Dañado' },
];

const TITLES = {
  assign: 'Asignar GPS a dispositivo',
  reassign: 'Reasignar GPS',
  unassign: 'Retirar GPS del dispositivo',
};

const GpsAssignmentDialog = ({ open, action, devices, currentDeviceId, onClose, onSubmit }) => {
  const unassigning = action === 'unassign';
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm({ deviceId: '', reason: '', notes: '', targetStatus: 'en_almacen' });
      setError(null);
    }
  }, [open]);

  const change = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async () => {
    if (!unassigning && !form.deviceId) {
      setError('Selecciona un dispositivo.');
      return;
    }
    if (!form.reason?.trim()) {
      setError('Indica el motivo de la operación.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        ...form,
        deviceId: form.deviceId ? Number(form.deviceId) : undefined,
      });
      onClose();
    } catch (exception) {
      setError(exception.message || 'No fue posible completar la operación.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{TITLES[action]}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {!unassigning && (
            <TextField
              select
              required
              label="Dispositivo destino"
              value={form.deviceId || ''}
              onChange={change('deviceId')}
            >
              {devices
                .filter((device) => device.id !== currentDeviceId)
                .map((device) => (
                  <MenuItem key={device.id} value={device.id}>
                    {device.name} · {device.uniqueId}
                  </MenuItem>
                ))}
            </TextField>
          )}
          {unassigning && (
            <TextField
              select
              required
              label="Estado después del retiro"
              value={form.targetStatus || 'en_almacen'}
              onChange={change('targetStatus')}
            >
              {TARGET_STATUSES.map((status) => (
                <MenuItem key={status.value} value={status.value}>
                  {status.label}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            required
            label="Motivo"
            value={form.reason || ''}
            onChange={change('reason')}
            inputProps={{ maxLength: 512 }}
          />
          <TextField
            label="Observaciones"
            value={form.notes || ''}
            onChange={change('notes')}
            multiline
            rows={3}
          />
          <Alert severity="info">
            Esta operación actualiza únicamente el inventario. No cambia el identificador operativo
            ni la transmisión del dispositivo.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={submit} disabled={saving}>
          {saving ? 'Guardando…' : 'Confirmar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GpsAssignmentDialog;

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

const RESULTS = [
  { value: 'operational', label: 'Operativo' },
  { value: 'repaired', label: 'Reparado' },
  { value: 'requires_repair', label: 'Requiere reparación' },
  { value: 'observation', label: 'En observación' },
  { value: 'unrepairable', label: 'No reparable' },
];

const GpsInspectionDialog = ({ open, inspection, onClose, onSubmit }) => {
  const completing = Boolean(inspection);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm({ result: '', findings: '', actionsTaken: '', nextInspectionAt: '', notes: '' });
      setError(null);
    }
  }, [open]);

  const change = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async () => {
    if (completing && !form.result) {
      setError('Selecciona el resultado de la revisión.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(
        completing
          ? {
              ...form,
              nextInspectionAt: form.nextInspectionAt
                ? new Date(`${form.nextInspectionAt}T00:00:00`).toISOString()
                : null,
            }
          : { notes: form.notes || null },
      );
      onClose();
    } catch (exception) {
      setError(
        exception.message?.includes('405')
          ? 'El backend aún no tiene activa esta operación. Reinicia el servicio con la versión actual.'
          : exception.message || 'No fue posible registrar la revisión.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {completing ? 'Completar revisión técnica' : 'Iniciar revisión técnica'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {completing && (
            <>
              <TextField
                select
                required
                label="Resultado"
                value={form.result || ''}
                onChange={change('result')}
              >
                {RESULTS.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Diagnóstico / hallazgos"
                value={form.findings || ''}
                onChange={change('findings')}
                multiline
                rows={3}
              />
              <TextField
                label="Acciones realizadas"
                value={form.actionsTaken || ''}
                onChange={change('actionsTaken')}
                multiline
                rows={3}
              />
              <TextField
                label="Próxima revisión"
                type="date"
                value={form.nextInspectionAt || ''}
                onChange={change('nextInspectionAt')}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </>
          )}
          <TextField
            label="Observaciones"
            value={form.notes || ''}
            onChange={change('notes')}
            multiline
            rows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={submit} disabled={saving}>
          {saving ? 'Guardando…' : completing ? 'Completar revisión' : 'Iniciar revisión'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GpsInspectionDialog;

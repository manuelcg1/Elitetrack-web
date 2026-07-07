import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Alert,
} from '@mui/material';
import { GPS_BRANDS, GPS_STATUS, isValidImei } from './gpsConstants';

const EMPTY_FORM = {
  imei: '',
  brand: '',
  model: '',
  serialNumber: '',
  notes: '',
};

/**
 * GpsFormDialog — Formulario de alta/edición de un GPS en inventario.
 *
 * Props:
 * - open: boolean
 * - gps: object|null — null para crear, objeto para editar
 * - onClose: () => void
 * - onSave: (gpsData) => Promise<void>
 */
const GpsFormDialog = ({ open, gps, onClose, onSave }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isEditing = Boolean(gps?.id);

  // ── Sincronizar formulario al abrir ───────────────────────────────────────
  useEffect(() => {
    if (open) {
      setForm(gps ? { ...EMPTY_FORM, ...gps } : EMPTY_FORM);
      setError(null);
    }
  }, [open, gps]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const validate = () => {
    if (!isValidImei(form.imei)) {
      return 'El IMEI debe tener exactamente 15 dígitos numéricos.';
    }
    if (!form.brand) {
      return 'Selecciona una marca.';
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...form,
        id: gps?.id,
        status: form.status || GPS_STATUS.EN_ALMACEN,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Ocurrió un error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? 'Editar GPS' : 'Agregar GPS al inventario'}</DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="IMEI"
            value={form.imei}
            onChange={handleChange('imei')}
            required
            fullWidth
            slotProps={{ htmlInput: { maxLength: 15 } }}
            helperText="15 dígitos numéricos"
            autoFocus
          />

          <TextField
            select
            label="Marca / Modelo"
            value={form.brand}
            onChange={handleChange('brand')}
            required
            fullWidth
          >
            {GPS_BRANDS.map((brand) => (
              <MenuItem key={brand.value} value={brand.value}>
                {brand.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Modelo específico (opcional)"
            value={form.model}
            onChange={handleChange('model')}
            placeholder="Ej: GT06N, ST300, GV300"
            fullWidth
          />

          <TextField
            label="Número de serie (opcional)"
            value={form.serialNumber}
            onChange={handleChange('serialNumber')}
            fullWidth
          />

          <TextField
            label="Notas"
            value={form.notes}
            onChange={handleChange('notes')}
            multiline
            rows={2}
            fullWidth
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GpsFormDialog;

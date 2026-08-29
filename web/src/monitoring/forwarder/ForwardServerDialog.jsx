import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material';

const emptyItem = {
  name: '',
  type: 'GENERIC_JSON',
  environment: 'DEVELOPMENT',
  ipDominio: '',
  username: '',
  password: '',
  apiKey: '',
  apiKeyConfigured: false,
  connectTimeout: 5000,
  readTimeout: 10000,
  maxAttempts: 5,
  retryDelay: 1000,
  transmissionEnabled: false,
  active: true,
};

const sutranEndpoints = {
  DEVELOPMENT: 'https://ws03.sutran.ehg.pe/api/v2.0/transmisiones',
  PRODUCTION: 'https://ws03.sutran.gob.pe/api/v2.0/transmisiones',
};

const ForwardServerDialog = ({ open, item, onClose, onSave }) => {
  const [form, setForm] = useState(emptyItem);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm(item ? { ...emptyItem, ...item, password: '', apiKey: '' } : emptyItem);
    setError(null);
    setSaving(false);
  }, [item, open]);

  const handleChange = (name, value) => {
    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === 'type' && value !== previous.type
        ? { apiKey: '', apiKeyConfigured: false }
        : {}),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const sutran = form.type === 'SUTRAN_V2';
      await onSave({
        ...form,
        name: form.name.trim(),
        ipDominio: sutran ? sutranEndpoints[form.environment] : form.ipDominio.trim(),
        username: sutran ? '' : form.username?.trim() || '',
        password: sutran ? '' : form.password || '',
        apiKey: form.apiKey?.trim() || '',
      });
    } catch (e) {
      setError(e.message || 'No se pudo guardar el destino');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{form.id ? 'Editar destino' : 'Nuevo destino'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Nombre"
            value={form.name}
            onChange={(event) => handleChange('name', event.target.value)}
            fullWidth
            required
          />
          <TextField
            select
            label="Tipo de destino"
            value={form.type}
            onChange={(event) => handleChange('type', event.target.value)}
            fullWidth
          >
            <MenuItem value="GENERIC_JSON">JSON genérico / Central Perú</MenuItem>
            <MenuItem value="SUTRAN_V2">SUTRAN v2</MenuItem>
          </TextField>
          {form.type === 'SUTRAN_V2' && (
            <TextField
              select
              label="Ambiente SUTRAN"
              value={form.environment}
              onChange={(event) => handleChange('environment', event.target.value)}
              helperText="Producción debe habilitarse únicamente después del piloto."
              fullWidth
            >
              <MenuItem value="DEVELOPMENT">Desarrollo</MenuItem>
              <MenuItem value="PRODUCTION">Producción</MenuItem>
            </TextField>
          )}
          <TextField
            label="IP / dominio / endpoint"
            value={form.type === 'SUTRAN_V2' ? sutranEndpoints[form.environment] : form.ipDominio}
            onChange={(event) => handleChange('ipDominio', event.target.value)}
            placeholder="https://servidor.com/api/positions"
            disabled={form.type === 'SUTRAN_V2'}
            fullWidth
            required
          />
          {form.type !== 'SUTRAN_V2' && (
            <>
              <TextField
                label="Usuario"
                value={form.username || ''}
                onChange={(event) => handleChange('username', event.target.value)}
                fullWidth
                required
              />
              <TextField
                label="Contraseña"
                value={form.password || ''}
                onChange={(event) => handleChange('password', event.target.value)}
                type="password"
                helperText={form.id ? 'Déjala vacía para conservar la contraseña actual.' : ''}
                fullWidth
                required={!form.id}
              />
            </>
          )}
          <TextField
            label={form.type === 'SUTRAN_V2' ? 'Access token' : 'API key'}
            value={form.apiKey || ''}
            onChange={(event) => handleChange('apiKey', event.target.value)}
            type="password"
            helperText={
              form.apiKeyConfigured
                ? 'Credencial configurada. Déjala vacía para conservarla.'
                : form.type === 'SUTRAN_V2'
                  ? 'UUID entregado por SUTRAN; se enviará en access-token.'
                  : 'Se enviará en el encabezado x-api-key.'
            }
            fullWidth
            required={!form.apiKeyConfigured}
          />
          {form.type === 'SUTRAN_V2' && (
            <>
              <Alert severity={form.transmissionEnabled ? 'warning' : 'info'}>
                {form.transmissionEnabled
                  ? 'Este destino enviará posiciones reales. Habilítalo solo para el vehículo piloto.'
                  : 'La transmisión está deshabilitada para este destino.'}
              </Alert>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(form.transmissionEnabled)}
                    onChange={(event) => handleChange('transmissionEnabled', event.target.checked)}
                    color="warning"
                  />
                }
                label={
                  form.transmissionEnabled
                    ? 'Retransmisión SUTRAN habilitada'
                    : 'Retransmisión SUTRAN deshabilitada'
                }
              />
            </>
          )}
          {form.type === 'SUTRAN_V2' && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Timeout de conexión (ms)"
                value={form.connectTimeout}
                onChange={(event) => handleChange('connectTimeout', Number(event.target.value))}
                type="number"
                inputProps={{ min: 100, max: 60000 }}
                fullWidth
              />
              <TextField
                label="Timeout de respuesta (ms)"
                value={form.readTimeout}
                onChange={(event) => handleChange('readTimeout', Number(event.target.value))}
                type="number"
                inputProps={{ min: 100, max: 120000 }}
                fullWidth
              />
            </Stack>
          )}
          {form.type === 'SUTRAN_V2' && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Intentos máximos"
                value={form.maxAttempts}
                onChange={(event) => handleChange('maxAttempts', Number(event.target.value))}
                type="number"
                inputProps={{ min: 1, max: 20 }}
                fullWidth
              />
              <TextField
                label="Espera inicial (ms)"
                value={form.retryDelay}
                onChange={(event) => handleChange('retryDelay', Number(event.target.value))}
                type="number"
                inputProps={{ min: 100, max: 3600000 }}
                fullWidth
              />
            </Stack>
          )}
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form.active)}
                onChange={(event) => handleChange('active', event.target.checked)}
              />
            }
            label={form.active ? 'Activo' : 'Inactivo'}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={
            saving ||
            !form.name.trim() ||
            (form.type !== 'SUTRAN_V2' && !form.ipDominio.trim()) ||
            (form.type !== 'SUTRAN_V2' && !form.username?.trim()) ||
            (form.type !== 'SUTRAN_V2' && !form.id && !form.password) ||
            (!form.apiKeyConfigured && !form.apiKey?.trim())
          }
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ForwardServerDialog;

import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
} from '@mui/material';

const emptyItem = {
  name: '',
  ipDominio: '',
  username: '',
  password: '',
  active: true,
};

const ForwardServerDialog = ({ open, item, onClose, onSave }) => {
  const [form, setForm] = useState(emptyItem);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm(item || emptyItem);
    setError(null);
    setSaving(false);
  }, [item, open]);

  const handleChange = (name, value) => {
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        ipDominio: form.ipDominio.trim(),
        username: form.username?.trim() || '',
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
            label="IP / dominio / endpoint"
            value={form.ipDominio}
            onChange={(event) => handleChange('ipDominio', event.target.value)}
            placeholder="https://servidor.com/api/positions"
            fullWidth
            required
          />
          <TextField
            label="Usuario"
            value={form.username || ''}
            onChange={(event) => handleChange('username', event.target.value)}
            fullWidth
          />
          <TextField
            label="Contrasena"
            value={form.password || ''}
            onChange={(event) => handleChange('password', event.target.value)}
            type="password"
            fullWidth
          />
          <FormControlLabel
            control={(
              <Switch
                checked={Boolean(form.active)}
                onChange={(event) => handleChange('active', event.target.checked)}
              />
            )}
            label={form.active ? 'Activo' : 'Inactivo'}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !form.name.trim() || !form.ipDominio.trim()}
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ForwardServerDialog;

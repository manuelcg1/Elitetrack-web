import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';

const TelegramLinkDialog = ({ user, open, onClose, onSave }) => {
  const [chatId, setChatId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setChatId('');
    setError('');
  }, [open, user]);

  const handleSave = () => {
    if (chatId.startsWith('-')) {
      setError('Los grupos de Telegram aún no son compatibles.');
    } else if (!/^\d{5,20}$/.test(chatId)) {
      setError('Ingrese un Chat ID individual de 5 a 20 dígitos.');
    } else {
      onSave(chatId);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{user?.linked ? 'Editar vinculación' : 'Vincular Telegram'}</DialogTitle>
      <DialogContent>
        <TextField fullWidth disabled label="Usuario" value={user?.name || ''} margin="normal" />
        <TextField
          fullWidth
          autoFocus
          label="Telegram Chat ID"
          value={chatId}
          onChange={(event) => {
            setChatId(event.target.value.trim());
            setError('');
          }}
          error={!!error}
          helperText={error || 'Solo se permiten chats individuales.'}
          inputMode="numeric"
          margin="normal"
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          El usuario debe abrir el bot @EliteTrackNotificacionBot y enviar /start. Luego el
          administrador registra el Chat ID obtenido mediante getUpdates.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={!chatId}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TelegramLinkDialog;

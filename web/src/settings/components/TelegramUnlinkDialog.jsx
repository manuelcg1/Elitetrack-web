import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

const TelegramUnlinkDialog = ({ user, open, onClose, onConfirm }) => (
  <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
    <DialogTitle>¿Desea desvincular Telegram?</DialogTitle>
    <DialogContent>
      <Typography>{user?.name} dejará de recibir notificaciones por Telegram.</Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancelar</Button>
      <Button color="error" variant="contained" onClick={onConfirm}>
        Desvincular
      </Button>
    </DialogActions>
  </Dialog>
);

export default TelegramUnlinkDialog;

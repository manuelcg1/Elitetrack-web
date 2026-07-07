import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

const GeofenceFolderDeleteDialog = ({ open, folder, onClose, onConfirm }) => (
  <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
    <DialogTitle>Eliminar carpeta</DialogTitle>

    <DialogContent>
      <DialogContentText>
        ¿Deseas eliminar la carpeta "{folder?.name}" junto con todas sus subcarpetas y geocercas?
      </DialogContentText>
    </DialogContent>

    <DialogActions>
      <Button onClick={onClose}>Cancelar</Button>
      <Button color="error" variant="contained" onClick={onConfirm}>
        Eliminar carpeta con geocercas
      </Button>
    </DialogActions>
  </Dialog>
);

export default GeofenceFolderDeleteDialog;

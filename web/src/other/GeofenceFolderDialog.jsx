import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';

const GeofenceFolderDialog = ({ open, folder, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    setName(folder?.name || '');
    setDescription(folder?.description || '');
  }, [folder]);

  const handleSave = () => {
    if (!name.trim()) return;

    onSave({
      ...folder,
      name: name.trim(),
      description: description.trim(),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {folder?.id ? 'Editar carpeta' : 'Crear carpeta'}
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <TextField
          autoFocus
          label="Nombre de carpeta"
          value={name}
          onChange={(event) => setName(event.target.value)}
          fullWidth
          required
        />

        <TextField
          label="Descripción"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          fullWidth
          multiline
          minRows={2}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={!name.trim()}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GeofenceFolderDialog;
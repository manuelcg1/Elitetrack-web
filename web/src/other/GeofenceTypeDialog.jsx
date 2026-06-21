import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';

const GeofenceTypeDialog = ({ open, onClose, onSelect }) => (
  <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
    <DialogTitle>Seleccionar tipo de geocerca</DialogTitle>

    <DialogContent>
      <List>
        <ListItemButton onClick={() => onSelect('polygon')}>
          <ListItemText primary="Poligonal" secondary="Dibujar un área con varios puntos" />
        </ListItemButton>

        <ListItemButton onClick={() => onSelect('circle')}>
          <ListItemText primary="Circular" secondary="Dibujar un círculo en el mapa" />
        </ListItemButton>

        <ListItemButton onClick={() => onSelect('polyline')}>
          <ListItemText primary="Lineal" secondary="Dibujar una ruta o línea" />
        </ListItemButton>
      </List>
    </DialogContent>

    <DialogActions>
      <Button onClick={onClose}>Cancelar</Button>
    </DialogActions>
  </Dialog>
);

export default GeofenceTypeDialog;
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  Box,
  Avatar,
} from '@mui/material';

import LocationOnIcon from '@mui/icons-material/LocationOn';

const GeofenceDeleteDialog = ({
  open,
  geofence,
  onClose,
  onConfirm,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    fullWidth
    maxWidth="xs"
  >
    <DialogTitle sx={{ pb: 1 }}>
      Confirmar eliminación
    </DialogTitle>

    <DialogContent>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
          mt: 1,
        }}
      >
        <Avatar
          sx={{
            bgcolor: 'error.light',
            color: 'error.dark',
            width: 52,
            height: 52,
          }}
        >
          <LocationOnIcon />
        </Avatar>

        <Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              mb: 0.5,
            }}
          >
            Eliminar geocerca
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
          >
            ¿Deseas eliminar la geocerca:
          </Typography>

          <Typography
            variant="subtitle1"
            sx={{
              mt: 1,
              fontWeight: 700,
              color: 'error.main',
            }}
          >
            {geofence?.name}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1 }}
          >
            Esta acción no se puede deshacer.
          </Typography>
        </Box>
      </Box>
    </DialogContent>

    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button
        variant="outlined"
        onClick={onClose}
      >
        Cancelar
      </Button>

      <Button
        color="error"
        variant="contained"
        onClick={onConfirm}
      >
        Eliminar geocerca
      </Button>
    </DialogActions>
  </Dialog>
);

export default GeofenceDeleteDialog;
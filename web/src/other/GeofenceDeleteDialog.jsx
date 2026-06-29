import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

const GeofenceDeleteDialog = ({
  open,
  geofence,
  onClose,
  onConfirm,
  loading = false,
}) => (
  <Dialog
    open={open}
    onClose={loading ? undefined : onClose}
    fullWidth
    maxWidth="xs"
    PaperProps={{
      sx: {
        borderRadius: 2,
        boxShadow: '0 18px 60px rgba(15, 23, 42, 0.22)',
      },
    }}
  >
    <DialogTitle sx={{ pb: 0.5, fontWeight: 700 }}>
      Confirmar eliminacion
    </DialogTitle>

    <DialogContent sx={{ pt: 1 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
          mt: 1.5,
        }}
      >
        <Avatar
          sx={{
            bgcolor: 'rgba(211, 47, 47, 0.12)',
            color: 'error.main',
            width: 56,
            height: 56,
          }}
        >
          <WarningAmberIcon />
        </Avatar>

        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            Eliminar geocerca
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Esta accion eliminara permanentemente la geocerca seleccionada:
          </Typography>

          <Box
            sx={{
              mt: 1,
              px: 1.5,
              py: 1,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                color: 'text.primary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {geofence?.name || 'Geocerca sin nombre'}
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Esta accion no se puede deshacer.
          </Typography>
        </Box>
      </Box>
    </DialogContent>

    <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
      <Button variant="outlined" onClick={onClose} disabled={loading}>
        Cancelar
      </Button>

      <Button
        color="error"
        variant="contained"
        onClick={onConfirm}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <DeleteForeverIcon />}
      >
        {loading ? 'Eliminando' : 'Eliminar geocerca'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default GeofenceDeleteDialog;

import { useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useCatch } from '../../reactHelper';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import BaseCommandView from './BaseCommandView';

const CommandDeviceDialog = ({ deviceId, deviceName, open, onClose }) => {
  const t = useTranslation();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));

  const [savedId, setSavedId] = useState(0);
  const [item, setItem] = useState({});
  const [sending, setSending] = useState(false);

  const handleSend = useCatch(async () => {
    setSending(true);
    try {
      let command;
      if (savedId) {
        const response = await fetchOrThrow(`/api/commands/${savedId}`);
        command = await response.json();
      } else {
        command = item;
      }

      await fetchOrThrow('/api/commands/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...command, deviceId: Number(deviceId) }),
      });
      onClose();
    } finally {
      setSending(false);
    }
  });

  const valid = savedId || item?.type;

  return (
    <Dialog
      open={open}
      onClose={sending ? undefined : onClose}
      fullScreen={phone}
      fullWidth
      maxWidth="xs"
      aria-labelledby="command-device-dialog-title"
    >
      <DialogTitle
        id="command-device-dialog-title"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}
      >
        <div>
          <Typography component="span" variant="h6">
            {t('commandTitle')}
          </Typography>
          {deviceName && (
            <Typography variant="body2" color="text.secondary">
              {deviceName}
            </Typography>
          )}
        </div>
        <IconButton edge="end" aria-label={t('sharedClose')} onClick={onClose} disabled={sending}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 2 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <BaseCommandView
            deviceId={deviceId}
            item={item}
            setItem={setItem}
            includeSaved
            savedId={savedId}
            setSavedId={setSavedId}
          />
        </div>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={sending}>
          {t('sharedCancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={!valid || sending}
          startIcon={sending ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {t('commandSend')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CommandDeviceDialog;

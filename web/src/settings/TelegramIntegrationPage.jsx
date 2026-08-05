import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import SendIcon from '@mui/icons-material/Send';
import { useAdministrator } from '../common/util/permissions';
import { useCatch, useEffectAsync } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from './components/SettingsMenu';
import TelegramLinkDialog from './components/TelegramLinkDialog';
import TelegramUnlinkDialog from './components/TelegramUnlinkDialog';

const botLabels = {
  connected: { label: 'Conectado', color: 'success' },
  notConfigured: { label: 'No configurado', color: 'warning' },
  connectionError: { label: 'Error de conexión', color: 'error' },
};

const SummaryCard = ({ title, value, children }) => (
  <Card variant="outlined" sx={{ minWidth: 0 }}>
    <CardContent>
      <Typography color="text.secondary" variant="body2">
        {title}
      </Typography>
      {children || (
        <Typography variant="h4" sx={{ mt: 1 }}>
          {value}
        </Typography>
      )}
    </CardContent>
  </Card>
);

const TelegramIntegrationPage = () => {
  const admin = useAdministrator();
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState('notConfigured');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [linkUser, setLinkUser] = useState(null);
  const [unlinkUser, setUnlinkUser] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCatch(async () => {
    setLoading(true);
    try {
      const [usersResponse, statusResponse] = await Promise.all([
        fetchOrThrow('/api/telegram/users'),
        fetchOrThrow('/api/telegram/status'),
      ]);
      setUsers(await usersResponse.json());
      setStatus((await statusResponse.json()).status);
    } finally {
      setLoading(false);
    }
  });

  useEffectAsync(async () => load(), []);

  const filteredUsers = useMemo(() => {
    const keyword = search.toLocaleLowerCase();
    return users.filter((user) =>
      [user.name, user.email].some((value) => value?.toLocaleLowerCase().includes(keyword)),
    );
  }, [search, users]);

  const linkedCount = users.filter((user) => user.linked).length;
  const bot = botLabels[status] || botLabels.connectionError;

  const saveLink = useCatch(async (chatId) => {
    await fetchOrThrow(`/api/telegram/users/${linkUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramChatId: chatId }),
    });
    setLinkUser(null);
    setMessage({ severity: 'success', text: 'Telegram vinculado correctamente.' });
    await load();
  });

  const unlink = useCatch(async () => {
    await fetchOrThrow(`/api/telegram/users/${unlinkUser.id}`, { method: 'DELETE' });
    setUnlinkUser(null);
    setMessage({ severity: 'success', text: 'Vinculación eliminada.' });
    await load();
  });

  const sendTest = useCatch(async (user) => {
    await fetchOrThrow(`/api/telegram/users/${user.id}/test`, { method: 'POST' });
    setMessage({ severity: 'success', text: `Mensaje de prueba enviado a ${user.name}.` });
  });

  if (!admin) {
    return <Navigate to="/" replace />;
  }

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'Integraciones', 'Telegram']}
    >
      <Stack spacing={2} sx={{ p: { xs: 1, sm: 2 } }}>
        <Box>
          <Typography variant="h5">Integración con Telegram</Typography>
          <Typography color="text.secondary">
            Administre las notificaciones individuales de los usuarios de EliteTrack.
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          <SummaryCard title="Usuarios" value={users.length} />
          <SummaryCard title="Usuarios vinculados" value={linkedCount} />
          <SummaryCard title="Usuarios pendientes" value={users.length - linkedCount} />
          <SummaryCard title="Estado del Bot">
            <Chip label={bot.label} color={bot.color} sx={{ mt: 1 }} />
          </SummaryCard>
        </Box>
        <TextField
          size="small"
          placeholder="Buscar por usuario o correo"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell>Usuario</TableCell>
                <TableCell>Correo</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Chat Telegram</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={user.linked ? 'Vinculado' : 'No vinculado'}
                      color={user.linked ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{user.maskedChatId || '—'}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title={user.linked ? 'Editar' : 'Vincular'}>
                        <IconButton onClick={() => setLinkUser(user)}>
                          {user.linked ? <EditIcon /> : <LinkIcon />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Enviar prueba">
                        <span>
                          <IconButton
                            disabled={!user.linked || status !== 'connected'}
                            onClick={() => sendTest(user)}
                          >
                            <SendIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Desvincular">
                        <span>
                          <IconButton
                            color="error"
                            disabled={!user.linked}
                            onClick={() => setUnlinkUser(user)}
                          >
                            <DeleteOutlineIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        )}
        {!loading && filteredUsers.length === 0 && (
          <Typography align="center" color="text.secondary">
            No se encontraron usuarios.
          </Typography>
        )}
      </Stack>
      <TelegramLinkDialog
        user={linkUser}
        open={!!linkUser}
        onClose={() => setLinkUser(null)}
        onSave={saveLink}
      />
      <TelegramUnlinkDialog
        user={unlinkUser}
        open={!!unlinkUser}
        onClose={() => setUnlinkUser(null)}
        onConfirm={unlink}
      />
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage(null)}>
        <Alert severity={message?.severity || 'success'} onClose={() => setMessage(null)}>
          {message?.text}
        </Alert>
      </Snackbar>
    </PageLayout>
  );
};

export default TelegramIntegrationPage;

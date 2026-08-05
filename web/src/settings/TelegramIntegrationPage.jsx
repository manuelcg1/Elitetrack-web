import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Card,
  CardContent,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import SendIcon from '@mui/icons-material/Send';
import TelegramIcon from '@mui/icons-material/Telegram';
import { useAdministrator } from '../common/util/permissions';
import { useCatch, useEffectAsync } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from './components/SettingsMenu';
import TelegramLinkDialog from './components/TelegramLinkDialog';
import TelegramUnlinkDialog from './components/TelegramUnlinkDialog';
import EliteTable, {
  EliteTableActionButton,
  EliteTableAvatar,
  EliteTablePrimaryText,
  EliteTableSecondaryText,
  EliteTableStatusChip,
} from '../common/components/EliteTable';

const botLabels = {
  connected: { label: 'Conectado', color: 'success' },
  notConfigured: { label: 'No configurado', color: 'warning' },
  connectionError: { label: 'Error de conexión', color: 'error' },
};

const SummaryCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'primary',
  valueColor = 'text.primary',
}) => (
  <Card
    variant="outlined"
    sx={{
      minWidth: 0,
      borderRadius: 2,
      borderColor: 'divider',
      boxShadow: (theme) => `0 4px 16px ${alpha(theme.palette.common.black, 0.035)}`,
    }}
  >
    <CardContent
      sx={{
        minHeight: 96,
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        '&:last-child': { pb: 1.5 },
      }}
    >
      <Box
        sx={(theme) => ({
          width: 44,
          height: 44,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          color: theme.palette[color].main,
          bgcolor: alpha(theme.palette[color].main, theme.palette.mode === 'dark' ? 0.18 : 0.1),
        })}
      >
        <Icon sx={{ fontSize: 24 }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography color="text.secondary" sx={{ fontSize: 12, fontWeight: 500 }} noWrap>
          {title}
        </Typography>
        <Typography
          sx={{ fontSize: 22, lineHeight: 1.25, fontWeight: 700, color: valueColor }}
          noWrap
        >
          {value}
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: 11 }} noWrap>
          {subtitle}
        </Typography>
      </Box>
    </CardContent>
  </Card>
);

const userInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

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

  const columns = useMemo(
    () => [
      {
        id: 'name',
        label: 'Usuario',
        sortable: true,
        minWidth: 220,
        render: (user) => (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <EliteTableAvatar>{userInitials(user.name)}</EliteTableAvatar>
            <Box sx={{ minWidth: 0 }}>
              <EliteTablePrimaryText noWrap>{user.name}</EliteTablePrimaryText>
              <EliteTableSecondaryText>
                {user.administrator ? 'Administrador' : 'Usuario'}
              </EliteTableSecondaryText>
            </Box>
          </Stack>
        ),
      },
      { id: 'email', label: 'Correo', sortable: true, minWidth: 240, hideOnMobile: true },
      {
        id: 'linked',
        label: 'Estado',
        sortable: true,
        minWidth: 140,
        render: (user) => (
          <EliteTableStatusChip
            label={user.linked ? 'Vinculado' : 'No vinculado'}
            color={user.linked ? 'success' : 'default'}
          />
        ),
      },
      {
        id: 'maskedChatId',
        label: 'Chat Telegram',
        sortable: true,
        minWidth: 160,
        render: (user) => (
          <Stack direction="row" spacing={1} alignItems="center">
            <TelegramIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Box component="span" sx={{ fontFamily: 'monospace', fontSize: 13 }}>
              {user.maskedChatId || '—'}
            </Box>
          </Stack>
        ),
        hideOnMobile: true,
      },
      {
        id: 'actions',
        label: 'Acciones',
        align: 'right',
        minWidth: 210,
        render: (user) => (
          <Stack direction="row" spacing={0.75} justifyContent="flex-end">
            <EliteTableActionButton
              label="Vincular"
              color="success"
              disabled={user.linked}
              onClick={() => setLinkUser(user)}
            >
              <LinkIcon />
            </EliteTableActionButton>
            <EliteTableActionButton
              label="Editar"
              color="primary"
              disabled={!user.linked}
              onClick={() => setLinkUser(user)}
            >
              <EditIcon />
            </EliteTableActionButton>
            <EliteTableActionButton
              label="Probar envío"
              color="info"
              disabled={!user.linked || status !== 'connected'}
              onClick={() => sendTest(user)}
            >
              <SendIcon />
            </EliteTableActionButton>
            <EliteTableActionButton
              label="Desvincular"
              color="error"
              disabled={!user.linked}
              onClick={() => setUnlinkUser(user)}
            >
              <DeleteOutlineIcon />
            </EliteTableActionButton>
          </Stack>
        ),
      },
    ],
    [sendTest, status],
  );

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
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 1.5,
          }}
        >
          <SummaryCard
            title="Usuarios"
            value={users.length}
            subtitle="Total de usuarios"
            icon={GroupsOutlinedIcon}
            color="primary"
          />
          <SummaryCard
            title="Usuarios vinculados"
            value={linkedCount}
            subtitle="Con Telegram"
            icon={LinkIcon}
            color="success"
          />
          <SummaryCard
            title="Usuarios pendientes"
            value={users.length - linkedCount}
            subtitle="Pendientes de vincular"
            icon={ScheduleOutlinedIcon}
            color="warning"
          />
          <SummaryCard
            title="Estado del Bot"
            value={bot.label}
            subtitle={
              status === 'connected' ? 'API activa y respondiendo' : 'Revise la configuración'
            }
            icon={SmartToyOutlinedIcon}
            color={bot.color}
            valueColor={`${bot.color}.main`}
          />
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
        <EliteTable
          columns={columns}
          rows={filteredUsers}
          initialSort={{ id: 'name', direction: 'asc' }}
          ariaLabel="Usuarios vinculados con Telegram"
          loading={loading}
          emptyState={{
            title: 'No se encontraron usuarios',
            description: search
              ? 'Pruebe con otro nombre o correo electrónico.'
              : 'Todavía no hay usuarios disponibles.',
          }}
        />
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

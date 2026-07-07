import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { useCatch, useEffectAsync } from '../reactHelper';
import PageLayout from '../common/components/PageLayout';
import fetchOrThrow from '../common/util/fetchOrThrow';
import RolesMenu from './components/RolesMenu';

const emptyRole = { name: '', menuKeys: [] };

const menuIcons = {
  vehicles: DirectionsCarOutlinedIcon,
  geofences: PlaceOutlinedIcon,
  map: MapOutlinedIcon,
  reports: DescriptionOutlinedIcon,
  settings: SettingsOutlinedIcon,
  alerts: WarningAmberOutlinedIcon,
  monitoring: NotificationsNoneOutlinedIcon,
};

const RoleBadge = ({ children, color = 'primary.main', textColor = 'primary.contrastText' }) => (
  <Box
    component="span"
    sx={{
      px: 0.75,
      py: 0.25,
      borderRadius: 10,
      bgcolor: color,
      color: textColor,
      fontSize: 11,
      fontWeight: 800,
      lineHeight: 1,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </Box>
);

const MenuIcon = ({ menuKey }) => {
  const Icon = menuIcons[menuKey] || SecurityOutlinedIcon;
  return <Icon sx={{ width: 16, height: 16, color: 'text.secondary' }} />;
};

const menuGridSx = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(180px, 1fr))',
    lg: 'repeat(3, minmax(180px, 1fr))',
  },
  columnGap: 4,
  rowGap: 1.25,
};

const checkboxSx = {
  p: 0,
  mr: 1.2,
};

const roleNameFieldSx = {
  flex: 1,
  minWidth: 0,
  '& .MuiInputBase-root': {
    fontWeight: 800,
    fontSize: 16,
  },
  '& .MuiInputBase-input': {
    p: 0,
  },
};

const MenuCheckbox = ({ menu, checked, onChange }) => (
  <Stack direction="row" alignItems="center" sx={{ minHeight: 24 }}>
    <Checkbox size="small" checked={checked} onChange={onChange} sx={checkboxSx} />
    <Stack direction="row" alignItems="center" spacing={1}>
      <MenuIcon menuKey={menu.key} />
      <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{menu.name}</Typography>
    </Stack>
  </Stack>
);

const RolesPage = () => {
  const [roles, setRoles] = useState([]);
  const [menus, setMenus] = useState([]);
  const [expandedRoleId, setExpandedRoleId] = useState(null);
  const [draftRole, setDraftRole] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createRole, setCreateRole] = useState(emptyRole);
  const [newRoleId, setNewRoleId] = useState(null);
  const [message, setMessage] = useState(null);

  const loadData = async () => {
    const [rolesResponse, menusResponse] = await Promise.all([
      fetchOrThrow('/api/roles'),
      fetchOrThrow('/api/roles/menus'),
    ]);
    setRoles(await rolesResponse.json());
    setMenus(await menusResponse.json());
  };

  useEffectAsync(async () => {
    await loadData();
  }, []);

  const displayMenus = menus.filter((menu) => menu.key !== 'roles');
  const displayMenuKeys = displayMenus.map((menu) => menu.key);

  const countVisibleMenus = (menuKeys = []) =>
    menuKeys.filter((menuKey) => displayMenuKeys.includes(menuKey)).length;

  const formatUsers = (count = 0) => `${count} ${count === 1 ? 'usuario' : 'usuarios'}`;

  const openCreateDialog = () => {
    setCreateRole({ ...emptyRole, menuKeys: [] });
    setCreateDialogOpen(true);
  };

  const toggleExpanded = (role) => {
    if (expandedRoleId === role.id) {
      setExpandedRoleId(null);
      setDraftRole(null);
    } else {
      setExpandedRoleId(role.id);
      setDraftRole({ ...role, menuKeys: [...(role.menuKeys || [])] });
    }
  };

  const toggleDraftMenu = (key) => {
    const existingKeys = draftRole.menuKeys || [];
    const hiddenKeys = existingKeys.filter((menuKey) => !displayMenuKeys.includes(menuKey));
    const visibleKeys = existingKeys.filter((menuKey) => displayMenuKeys.includes(menuKey));
    const nextVisibleKeys = visibleKeys.includes(key)
      ? visibleKeys.filter((menuKey) => menuKey !== key)
      : [...visibleKeys, key];
    setDraftRole({ ...draftRole, menuKeys: [...hiddenKeys, ...nextVisibleKeys] });
  };

  const toggleCreateMenu = (key) => {
    const menuKeys = createRole.menuKeys.includes(key)
      ? createRole.menuKeys.filter((menuKey) => menuKey !== key)
      : [...createRole.menuKeys, key];
    setCreateRole({ ...createRole, menuKeys });
  };

  const handleCreate = useCatch(async () => {
    const response = await fetchOrThrow('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createRole),
    });
    const savedRole = await response.json();
    setCreateDialogOpen(false);
    setNewRoleId(savedRole.id);
    setExpandedRoleId(savedRole.id);
    setDraftRole({ ...savedRole, menuKeys: [...(savedRole.menuKeys || [])] });
    setMessage({ text: 'Rol creado correctamente', severity: 'success' });
    await loadData();
  });

  const handleSaveDraft = useCatch(async () => {
    const response = await fetchOrThrow(`/api/roles/${draftRole.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draftRole),
    });
    const savedRole = await response.json();
    setDraftRole({ ...savedRole, menuKeys: [...(savedRole.menuKeys || [])] });
    setMessage({ text: 'Rol guardado correctamente', severity: 'success' });
    await loadData();
  });

  const handleDelete = useCatch(async (role) => {
    const response = await fetch(`/api/roles/${role.id}`, { method: 'DELETE' });
    if (response.status === 409) {
      setMessage({
        text: 'No se puede eliminar: el rol tiene usuarios asignados',
        severity: 'warning',
      });
    } else if (response.ok) {
      if (expandedRoleId === role.id) {
        setExpandedRoleId(null);
        setDraftRole(null);
      }
      setMessage({ text: 'Rol eliminado correctamente', severity: 'success' });
      await loadData();
    } else {
      throw Error(await response.text());
    }
  });

  return (
    <PageLayout menu={<RolesMenu />} breadcrumbs={['Roles', 'Rol']}>
      <Container maxWidth={false} sx={{ width: '100%', maxWidth: 'none', p: 2, m: 0 }}>
        <Paper variant="outlined" sx={{ width: '100%', borderRadius: 1, p: 2 }}>
          <Stack
            direction="row"
            alignItems="flex-start"
            justifyContent="space-between"
            spacing={2}
            sx={{ mb: 2 }}
          >
            <Stack direction="row" spacing={1.25}>
              <SecurityOutlinedIcon sx={{ color: 'text.secondary', mt: 0.25 }} />
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>
                  Roles y menus
                </Typography>
                <Typography color="text.secondary" sx={{ fontWeight: 700, fontSize: 13, mt: 1 }}>
                  {roles.length} roles configurados
                </Typography>
              </Box>
            </Stack>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={openCreateDialog}
              sx={{ borderRadius: 1, fontWeight: 800, textTransform: 'none' }}
            >
              Nuevo rol
            </Button>
          </Stack>

          <Stack spacing={1}>
            {roles.map((role) => {
              const expanded = expandedRoleId === role.id && draftRole;
              const activeRole = expanded ? draftRole : role;
              return (
                <Paper
                  key={role.id}
                  variant="outlined"
                  sx={{
                    borderColor: expanded ? 'success.main' : 'divider',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1.25}
                    sx={{ px: 1.5, py: 1.25 }}
                  >
                    {expanded ? (
                      <TextField
                        variant="standard"
                        value={draftRole.name}
                        onChange={(event) =>
                          setDraftRole({ ...draftRole, name: event.target.value })
                        }
                        sx={roleNameFieldSx}
                        slotProps={{ input: { disableUnderline: true } }}
                      />
                    ) : (
                      <Typography
                        noWrap
                        sx={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 16 }}
                      >
                        {role.name}
                      </Typography>
                    )}
                    {newRoleId === role.id && (
                      <RoleBadge color="success.main" textColor="success.contrastText">
                        NUEVO
                      </RoleBadge>
                    )}
                    <RoleBadge>{formatUsers(role.userCount)}</RoleBadge>
                    <Typography
                      color="text.secondary"
                      sx={{ ml: 'auto', fontSize: 13, whiteSpace: 'nowrap' }}
                    >
                      {countVisibleMenus(activeRole.menuKeys)}/{displayMenus.length} menus
                    </Typography>
                    <Tooltip title="Eliminar">
                      <IconButton size="small" onClick={() => handleDelete(role)}>
                        <DeleteOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={expanded ? 'Contraer' : 'Expandir'}>
                      <IconButton size="small" onClick={() => toggleExpanded(role)}>
                        {expanded ? (
                          <ExpandLessIcon fontSize="small" />
                        ) : (
                          <ExpandMoreIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  {expanded && (
                    <Box sx={{ px: 2, pb: 1.5 }}>
                      <Box sx={menuGridSx}>
                        {displayMenus.map((menu) => (
                          <MenuCheckbox
                            key={menu.key}
                            menu={menu}
                            checked={(draftRole.menuKeys || []).includes(menu.key)}
                            onChange={() => toggleDraftMenu(menu.key)}
                          />
                        ))}
                      </Box>
                      <Divider sx={{ mt: 2, mb: 1 }} />
                      <Stack direction="row" justifyContent="flex-end">
                        <Button
                          variant="contained"
                          onClick={handleSaveDraft}
                          disabled={!draftRole.name.trim()}
                          sx={{ minWidth: 72, borderRadius: 1.5, textTransform: 'none' }}
                        >
                          Guardar
                        </Button>
                      </Stack>
                    </Box>
                  )}
                </Paper>
              );
            })}
          </Stack>
        </Paper>

        <Dialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle sx={{ p: 2.5, pb: 0.5 }}>
            <Stack direction="row" spacing={1.25} alignItems="flex-start">
              <SecurityOutlinedIcon sx={{ color: 'primary.main', mt: 0.2 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>
                  Nuevo rol
                </Typography>
                <Typography color="text.secondary" sx={{ fontWeight: 700, fontSize: 12 }}>
                  Define el nombre y que menus veran los usuarios con este rol
                </Typography>
              </Box>
            </Stack>
            <IconButton
              size="small"
              onClick={() => setCreateDialogOpen(false)}
              sx={{ position: 'absolute', top: 16, right: 16 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ px: 2.5, pt: 2 }}>
            <Stack spacing={2.25}>
              <TextField
                label="Nombre del rol"
                placeholder="Ej: Supervisor regional"
                value={createRole.name}
                onChange={(event) => setCreateRole({ ...createRole, name: event.target.value })}
                autoFocus
                fullWidth
              />
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: 13, mb: 1.25 }}>
                  Menus visibles
                </Typography>
                <Box sx={menuGridSx}>
                  {displayMenus.map((menu) => (
                    <MenuCheckbox
                      key={menu.key}
                      menu={menu}
                      checked={createRole.menuKeys.includes(menu.key)}
                      onChange={() => toggleCreateMenu(menu.key)}
                    />
                  ))}
                </Box>
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1.5 }}>
                  <InfoOutlinedIcon sx={{ width: 15, height: 15, color: 'text.secondary' }} />
                  <Typography color="text.secondary" sx={{ fontWeight: 700, fontSize: 11 }}>
                    Puedes dejar todo sin marcar y configurarlo despues
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 2.5, py: 2.25, borderTop: 1, borderColor: 'divider' }}>
            <Button
              variant="outlined"
              onClick={() => setCreateDialogOpen(false)}
              sx={{ borderRadius: 1.5, px: 2, textTransform: 'none', fontWeight: 800 }}
            >
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={!createRole.name.trim()}
              sx={{ borderRadius: 1.5, px: 2, textTransform: 'none', fontWeight: 800 }}
            >
              Crear rol
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={!!message}
          autoHideDuration={4000}
          onClose={() => setMessage(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity={message?.severity || 'success'}
            variant="filled"
            onClose={() => setMessage(null)}
          >
            {message?.text}
          </Alert>
        </Snackbar>
      </Container>
    </PageLayout>
  );
};

export default RolesPage;

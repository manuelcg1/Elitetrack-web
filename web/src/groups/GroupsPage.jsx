import { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Fab,
  InputAdornment,
  TextField,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { useEffectAsync, useCatch } from '../reactHelper';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from '../settings/components/SettingsMenu';
import { groupsActions } from '../store';
import useGroupTree from './useGroupTree';
import GroupTreeNode from './GroupTreeNode';
import fetchOrThrow from '../common/util/fetchOrThrow';

const ET = { green: '#00E65B' };

const GroupsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useTranslation();

  const limitCommands = useSelector((state) =>
    state.session.user?.attributes?.limitCommands ?? false,
  );
  const shareDisabled = useSelector(
    (state) => state.session.server.attributes.disableShare,
  );
  const user = useSelector((state) => state.session.user);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState('');

  const { tree } = useGroupTree();

  // ── Carga inicial de grupos ───────────────────────────────────────────────
  useEffectAsync(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchOrThrow('/api/groups');
      dispatch(groupsActions.refresh(await response.json()));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Eliminar grupo ────────────────────────────────────────────────────────
  const handleDelete = useCatch(async (groupId) => {
    await fetchOrThrow(`/api/groups/${groupId}`, { method: 'DELETE' });
    const response = await fetchOrThrow('/api/groups');
    dispatch(groupsActions.refresh(await response.json()));
  });

  // ── Filtrar árbol por keyword ─────────────────────────────────────────────
  const filterTree = useCallback((nodes, keyword) => {
    if (!keyword.trim()) return nodes;
    const lower = keyword.toLowerCase();

    const matchNode = (node) => {
      const nameMatch = node.name.toLowerCase().includes(lower);
      const filteredChildren = node.children.map(matchNode).filter(Boolean);
      if (nameMatch || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null;
    };

    return nodes.map(matchNode).filter(Boolean);
  }, []);

  const filteredTree = filterTree(tree, searchKeyword);
  const hasResults = filteredTree.length > 0;

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'settingsGroups']}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Buscador */}
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField
            fullWidth
            size="small"
            placeholder={t('sharedSearch')}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>

        {/* Contenido */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
              <CircularProgress size={32} />
            </Box>
          )}

          {!loading && error && (
            <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
          )}

          {!loading && !error && !hasResults && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 6, gap: 1, color: 'text.secondary' }}>
              <Typography variant="body2">
                {searchKeyword ? t('sharedNoResults') : t('settingsGroups')}
              </Typography>
              {!searchKeyword && (
                <Typography variant="caption">
                  Crea tu primer grupo con el botón +
                </Typography>
              )}
            </Box>
          )}

          {!loading && !error && hasResults && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {filteredTree.map((node) => (
                <GroupTreeNode
                  key={node.id}
                  node={node}
                  showCommands={!limitCommands}
                  showShare={!shareDisabled && !user.temporary}
                  onDelete={handleDelete}
                  defaultExpanded={Boolean(searchKeyword)}
                />
              ))}
            </Box>
          )}
        </Box>

        {/* FAB crear grupo raíz */}
        <Fab
          size="medium"
          onClick={() => navigate('/settings/group')}
          sx={{
            position: 'fixed',
            bottom: 32,
            right: 32,
            background: `linear-gradient(135deg, ${ET.green} 0%, #00B848 100%)`,
            color: '#212529',
            '&:hover': {
              background: `linear-gradient(135deg, #1AFF70 0%, ${ET.green} 100%)`,
              boxShadow: '0 4px 20px rgba(0,230,91,0.40)',
            },
          }}
        >
          <AddIcon />
        </Fab>
      </Box>
    </PageLayout>
  );
};

export default GroupsPage;

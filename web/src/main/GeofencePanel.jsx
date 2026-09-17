import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Checkbox,
  Collapse,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import { errorsActions, geofencesActions } from '../store';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { map } from '../map/core/MapView';
import { geofenceToFeature } from '../map/core/mapUtil';
import { readView } from '../common/util/geofenceReadView';
import { useTranslation } from '../common/components/LocalizationProvider';

const ROOT_ID = 0;

const getGeometryLabel = (area = '') => {
  if (area.startsWith('CIRCLE')) return 'Círculo';
  if (area.startsWith('LINESTRING')) return 'Ruta';
  return 'Polígono';
};

const buildTree = (folders, geofences) => {
  const root = { id: ROOT_ID, children: [], geofences: [] };
  const nodes = Object.fromEntries(
    folders.map((folder) => [folder.id, { ...folder, children: [], geofences: [] }]),
  );

  Object.values(nodes).forEach((folder) => {
    const parent = nodes[folder.parentid] || root;
    parent.children.push(folder);
  });
  geofences.forEach((geofence) => {
    const parent = nodes[Number(geofence.attributes?.folderId)] || root;
    parent.geofences.push(geofence);
  });
  return root;
};

const filterTree = (node, keyword) => {
  if (!keyword) return node;
  const search = keyword.toLocaleLowerCase();
  const children = node.children.map((child) => filterTree(child, keyword)).filter(Boolean);
  const geofences = node.geofences.filter((item) =>
    item.name?.toLocaleLowerCase().includes(search),
  );
  if (
    node.id === ROOT_ID ||
    node.name?.toLocaleLowerCase().includes(search) ||
    children.length ||
    geofences.length
  ) {
    return { ...node, children, geofences };
  }
  return null;
};

const getGeofenceIds = (node) => [
  ...node.geofences.map((item) => item.id),
  ...node.children.flatMap(getGeofenceIds),
];

const getCoordinates = (coordinates) =>
  coordinates.flatMap((value) => (Array.isArray(value?.[0]) ? getCoordinates(value) : [value]));

const TreeNode = ({
  node,
  level = 0,
  visibleIds,
  onToggleOne,
  onToggleMany,
  searching = false,
}) => {
  const t = useTranslation();
  const [open, setOpen] = useState(true);
  const root = node.id === ROOT_ID;
  const ids = getGeofenceIds(node);
  const allVisible = ids.length > 0 && ids.every((id) => visibleIds.includes(id));
  const someVisible = ids.some((id) => visibleIds.includes(id));

  return (
    <Box>
      {!root && (
        <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 44, pl: level * 2, pr: 1 }}>
          <IconButton
            size="small"
            aria-label={node.name}
            aria-expanded={searching || open}
            onClick={() => setOpen((value) => !value)}
          >
            {searching || open ? (
              <ExpandMoreIcon fontSize="small" />
            ) : (
              <ChevronRightIcon fontSize="small" />
            )}
          </IconButton>
          {searching || open ? (
            <FolderOpenIcon color="primary" fontSize="small" />
          ) : (
            <FolderIcon color="action" fontSize="small" />
          )}
          <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1, ml: 1 }}>
            {node.name}
          </Typography>
          <Checkbox
            size="small"
            checked={allVisible}
            indeterminate={someVisible && !allVisible}
            onChange={(event) => onToggleMany(ids, event.target.checked)}
            disabled={!ids.length}
            slotProps={{ input: { 'aria-label': `Mostrar carpeta ${node.name}` } }}
          />
        </Box>
      )}
      <Collapse in={root || searching || open} timeout={150}>
        {node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            level={root ? level : level + 1}
            visibleIds={visibleIds}
            onToggleOne={onToggleOne}
            onToggleMany={onToggleMany}
            searching={searching}
          />
        ))}
        {node.geofences.map((geofence) => (
          <Box
            key={geofence.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              minHeight: 58,
              pl: (root ? level : level + 1) * 2 + 2,
              pr: 1,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <PlaceOutlinedIcon fontSize="small" color="action" />
            <Box sx={{ flex: 1, minWidth: 0, ml: 1 }}>
              <Typography variant="body2" noWrap>
                {geofence.name}
              </Typography>
              {geofence.readInherited && <Chip size="small" label={t('geofenceInherited')} />}
              <Typography variant="caption" color="text.secondary">
                {getGeometryLabel(geofence.area)}
              </Typography>
            </Box>
            <Checkbox
              size="small"
              checked={visibleIds.includes(geofence.id)}
              onChange={(event) => onToggleOne(geofence.id, event.target.checked)}
              slotProps={{ input: { 'aria-label': `Mostrar geocerca ${geofence.name}` } }}
            />
          </Box>
        ))}
      </Collapse>
    </Box>
  );
};

const GeofencePanel = () => {
  const t = useTranslation();
  const dispatch = useDispatch();
  const theme = useTheme();
  const geofences = useSelector((state) => state.geofences.items);
  const visibleIds = useSelector((state) => state.geofences.visibleIds);
  const [folders, setFolders] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const userId = useSelector((state) => state.session.user?.id);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFolders([]);
    dispatch(geofencesActions.refresh([]));
    fetchOrThrow('/api/geofences/read-access')
      .then((response) => response.json())
      .then(readView)
      .then((data) => {
        if (!active) return;
        setFolders(data.folders);
        dispatch(geofencesActions.refresh(data.geofences));
      })
      .catch((error) => {
        if (!active) return;
        dispatch(geofencesActions.clearVisible());
        dispatch(errorsActions.push(error.message));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dispatch, userId, revision]);

  const tree = useMemo(
    () => filterTree(buildTree(folders, Object.values(geofences)), keyword),
    [folders, geofences, keyword],
  );
  const allIds = useMemo(() => Object.values(geofences).map((item) => item.id), [geofences]);
  const allVisible = allIds.length > 0 && allIds.every((id) => visibleIds.includes(id));
  const someVisible = allIds.some((id) => visibleIds.includes(id));

  const focusGeofences = useCallback(
    (ids) => {
      const coordinates = ids.flatMap((id) => {
        const geofence = geofences[id];
        if (!geofence?.area) return [];
        try {
          return getCoordinates(geofenceToFeature(theme, geofence).geometry.coordinates);
        } catch {
          return [];
        }
      });
      if (!coordinates.length) return;

      const lngs = coordinates.map(([lng]) => lng);
      const lats = coordinates.map(([, lat]) => lat);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 48, maxZoom: 16, duration: 700 },
      );
    },
    [geofences, theme],
  );

  const toggleMany = (ids, visible) => {
    dispatch(geofencesActions.setVisibleMany({ ids, visible }));
    if (visible) focusGeofences(ids);
  };

  const toggleOne = (id, visible) => {
    dispatch(geofencesActions.setVisible({ id, visible }));
    if (visible) focusGeofences([id]);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0 }}>
      <Box sx={{ p: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Button disabled={loading} onClick={() => setRevision((value) => value + 1)}>
          {t('geofenceRetry')}
        </Button>
        {loading && <Typography role="status">{t('sharedLoading')}</Typography>}
        <TextField
          size="small"
          fullWidth
          placeholder="Buscar geocercas"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="disabled" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ '& .MuiInputBase-root': { height: 40, borderRadius: 2 } }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 46, mt: 0.5 }}>
          <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
            Mostrar todas las geocercas
          </Typography>
          <Checkbox
            size="small"
            checked={allVisible}
            indeterminate={someVisible && !allVisible}
            onChange={(event) => toggleMany(allIds, event.target.checked)}
            disabled={!allIds.length}
            slotProps={{ input: { 'aria-label': 'Mostrar todas las geocercas' } }}
          />
        </Box>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {tree && (
          <TreeNode
            node={tree}
            visibleIds={visibleIds}
            onToggleOne={toggleOne}
            onToggleMany={toggleMany}
            searching={Boolean(keyword)}
          />
        )}
      </Box>
    </Box>
  );
};

export default GeofencePanel;

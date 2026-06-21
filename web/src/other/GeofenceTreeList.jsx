import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Checkbox,
  Collapse,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import GeofenceFolderDialog from './GeofenceFolderDialog';
import GeofenceFolderDeleteDialog from './GeofenceFolderDeleteDialog';
import GeofenceTypeDialog from './GeofenceTypeDialog';
import GeofenceDeleteDialog from './GeofenceDeleteDialog';

import fetchOrThrow from '../common/util/fetchOrThrow';
import { errorsActions, geofencesActions } from '../store';

const ROOT_PARENT_ID = 0;

const buildTree = (folders, geofences) => {
  const folderMap = {};
  const root = {
    id: ROOT_PARENT_ID,
    name: 'root',
    parentId: null,
    children: [],
    geofences: [],
  };

  folders.forEach((folder) => {
    folderMap[folder.id] = {
      ...folder,
      children: [],
      geofences: [],
    };
  });

  Object.values(folderMap).forEach((folder) => {
    const parentId = folder.parentid || ROOT_PARENT_ID;
    if (parentId && folderMap[parentId]) {
      folderMap[parentId].children.push(folder);
    } else {
      root.children.push(folder);
    }
  });

  geofences.forEach((geofence) => {
    const folderId = Number(geofence.attributes?.folderId || ROOT_PARENT_ID);
    if (folderId && folderMap[folderId]) {
      folderMap[folderId].geofences.push(geofence);
    } else {
      root.geofences.push(geofence);
    }
  });

  return root;
};

const getFolderGeofenceIds = (folder) => {
  const ids = folder.geofences.map((item) => item.id);

  folder.children.forEach((child) => {
    ids.push(...getFolderGeofenceIds(child));
  });

  return ids;
};

const filterTree = (node, search) => {
  if (!search) return node;

  const value = search.toLowerCase();

  const children = node.children
    .map((child) => filterTree(child, search))
    .filter(Boolean);

  const geofences = node.geofences.filter((geofence) => (
    geofence.name?.toLowerCase().includes(value)
  ));

  const folderMatches = node.name?.toLowerCase().includes(value);

  if (node.id === ROOT_PARENT_ID || folderMatches || children.length || geofences.length) {
    return {
      ...node,
      children,
      geofences,
    };
  }

  return null;
};

const GeofenceTreeNode = ({
  node,
  level = 0,
  visibleGeofenceIds,
  onToggleGeofence,
  onToggleFolder,
  onCreateFolder,
  onCreateGeofence,
  onEditFolder,
  onDeleteFolder,
  onDeleteGeofence,
}) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  const isRoot = node.id === ROOT_PARENT_ID;
  const geofenceIds = getFolderGeofenceIds(node);

  const checked = geofenceIds.length > 0
    && geofenceIds.every((id) => visibleGeofenceIds.includes(id));

  const indeterminate = geofenceIds.some((id) => visibleGeofenceIds.includes(id))
    && !checked;

  return (
    <Box>
      {!isRoot && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            pl: level * 2,
            py: 0.5,
            minWidth: 0,
          }}
        >
          <IconButton size="small" onClick={() => setOpen((prev) => !prev)}>
            {open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </IconButton>

          {open ? <FolderOpenIcon fontSize="small" /> : <FolderIcon fontSize="small" />}

          <Checkbox
            size="small"
            checked={checked}
            indeterminate={indeterminate}
            onChange={(event) => onToggleFolder(node, event.target.checked)}
          />

          <Typography
            variant="body2"
            noWrap
            sx={{ flex: 1, ml: 0.5, fontWeight: 600, minWidth: 0 }}
          >
            {node.name}
          </Typography>

          <Tooltip title="Crear subcarpeta">
            <IconButton size="small" onClick={() => onCreateFolder(node.id)}>
              <CreateNewFolderIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Crear geocerca">
            <IconButton size="small" onClick={() => onCreateGeofence(node.id)}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Editar carpeta">
            <IconButton size="small" onClick={() => onEditFolder(node)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Eliminar carpeta">
            <IconButton size="small" onClick={() => onDeleteFolder(node)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Collapse in={open || isRoot} timeout={150}>
        {node.children.map((child) => (
          <GeofenceTreeNode
            key={child.id}
            node={child}
            level={isRoot ? level : level + 1}
            visibleGeofenceIds={visibleGeofenceIds}
            onToggleGeofence={onToggleGeofence}
            onToggleFolder={onToggleFolder}
            onCreateFolder={onCreateFolder}
            onCreateGeofence={onCreateGeofence}
            onEditFolder={onEditFolder}
            onDeleteFolder={onDeleteFolder}
            onDeleteGeofence={onDeleteGeofence}
          />
        ))}

        {node.geofences.map((geofence) => (
          <Box
            key={geofence.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              pl: (isRoot ? level : level + 1) * 2,
              py: 0.5,
              minWidth: 0,
            }}
          >
            <Checkbox
              size="small"
              checked={visibleGeofenceIds.includes(geofence.id)}
              onChange={(event) => onToggleGeofence(geofence.id, event.target.checked)}
            />

            <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
              {geofence.name}
            </Typography>

            <IconButton size="small" onClick={() => navigate(`/settings/geofence/${geofence.id}`)}>
              <EditIcon fontSize="small" />
            </IconButton>

            <IconButton size="small" onClick={() => onDeleteGeofence(geofence)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
      </Collapse>
    </Box>
  );
};

const GeofenceTreeList = ({ onGeofenceSelected }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const geofences = useSelector((state) => state.geofences.items);

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [folderParentId, setFolderParentId] = useState(ROOT_PARENT_ID);

  const [deleteFolderDialogOpen, setDeleteFolderDialogOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState(null);

  const [deleteGeofenceDialogOpen, setDeleteGeofenceDialogOpen] = useState(false);
  const [geofenceToDelete, setGeofenceToDelete] = useState(null);

  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState(ROOT_PARENT_ID);

  const [folders, setFolders] = useState([]);
  const [search, setSearch] = useState('');
  const visibleGeofenceIds = useSelector((state) => state.geofences.visibleIds);

  const handleToggleFolder = (folder, visible) => {
  const ids = getFolderGeofenceIds(folder);
  dispatch(geofencesActions.setVisibleMany({ ids, visible }));
};

  const loadData = async () => {
    const [foldersResponse, geofencesResponse] = await Promise.all([
      fetchOrThrow('/api/geofenceFolders'),
      fetchOrThrow('/api/geofences'),
    ]);

    const foldersData = await foldersResponse.json();
    const geofencesData = await geofencesResponse.json();

    setFolders(foldersData);
    dispatch(geofencesActions.refresh(geofencesData));
    dispatch(geofencesActions.clearVisible());
  };

  useEffect(() => {
    loadData().catch((error) => dispatch(errorsActions.push(error.message)));
  }, [dispatch]);

  const tree = useMemo(() => {
    const builtTree = buildTree(folders, Object.values(geofences));
    return filterTree(builtTree, search) || builtTree;
  }, [folders, geofences, search]);

  const handleToggleGeofence = (id, visible) => {
  dispatch(geofencesActions.setVisible({ id, visible }));
  onGeofenceSelected?.(visible ? id : null);
};


  const handleCreateFolder = (parentId = ROOT_PARENT_ID) => {
    setEditingFolder(null);
    setFolderParentId(parentId);
    setFolderDialogOpen(true);
  };

  const handleEditFolder = (folder) => {
    setEditingFolder(folder);
    setFolderParentId(folder.parentid || ROOT_PARENT_ID);
    setFolderDialogOpen(true);
  };

  const handleDeleteFolder = (folder) => {
    setFolderToDelete(folder);
    setDeleteFolderDialogOpen(true);
  };

  const handleSaveFolder = async (folder) => {
    try {
      if (folder.id) {
        await fetchOrThrow(`/api/geofenceFolders/${folder.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(folder),
        });

        setFolders((current) => current.map((item) => (
          item.id === folder.id ? folder : item
        )));
      } else {
        const response = await fetchOrThrow('/api/geofenceFolders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: folder.name,
            description: folder.description || '',
            parentid: folderParentId || 0,
            attributes: {},
          }),
        });

        const created = await response.json();
        setFolders((current) => [...current, created]);
      }

      setFolderDialogOpen(false);
      setEditingFolder(null);
    } catch (error) {
      dispatch(errorsActions.push(error.message));
    }
  };

  const getFolderDeletePayload = (folder) => {
    const folderIds = [];

    const collectFolders = (node) => {
      folderIds.push(node.id);
      node.children.forEach(collectFolders);
    };

    collectFolders(folder);

    const geofenceIds = getFolderGeofenceIds(folder);

    return { folderIds, geofenceIds };
  };

  const handleConfirmDeleteFolder = async () => {
    if (!folderToDelete) return;

    try {
      const { folderIds, geofenceIds } = getFolderDeletePayload(folderToDelete);

      await Promise.all(
        geofenceIds.map((id) => fetchOrThrow(`/api/geofences/${id}`, { method: 'DELETE' })),
      );

      await Promise.all(
        folderIds
          .sort((a, b) => b - a)
          .map((id) => fetchOrThrow(`/api/geofenceFolders/${id}`, { method: 'DELETE' })),
      );

      dispatch(geofencesActions.setVisibleMany({ ids: geofenceIds, visible: false }));

      setDeleteFolderDialogOpen(false);
      setFolderToDelete(null);

      await loadData();
    } catch (error) {
      dispatch(errorsActions.push(error.message));
    }
  };

  const handleCreateGeofence = (folderId = ROOT_PARENT_ID) => {
    setSelectedFolderId(folderId);
    setTypeDialogOpen(true);
  };

  const handleSelectGeofenceType = (type) => {
    setTypeDialogOpen(false);
    navigate(`/geofences?folderId=${selectedFolderId}&type=${type}`);
  };

  const handleDeleteGeofence = (geofence) => {
    setGeofenceToDelete(geofence);
    setDeleteGeofenceDialogOpen(true);
  };

  const handleConfirmDeleteGeofence = async () => {
    if (!geofenceToDelete) return;

    try {
      await fetchOrThrow(`/api/geofences/${geofenceToDelete.id}`, {
        method: 'DELETE',
      });

      dispatch(geofencesActions.setVisible({
        id: geofenceToDelete.id,
        visible: false,
      }));

      setDeleteGeofenceDialogOpen(false);
      setGeofenceToDelete(null);

      await loadData();
    } catch (error) {
      dispatch(errorsActions.push(error.message));
    }
  };

  return (
    <Box sx={{ p: 1, overflow: 'auto', width: '100%', minWidth: 0 }}>
      <TextField
        size="small"
        fullWidth
        placeholder="Buscar geocerca"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        sx={{ mb: 1 }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          Carpetas
        </Typography>

        <Tooltip title="Crear carpeta">
          <IconButton size="small" onClick={() => handleCreateFolder(ROOT_PARENT_ID)}>
            <CreateNewFolderIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Crear geocerca sin carpeta">
          <IconButton size="small" onClick={() => handleCreateGeofence(ROOT_PARENT_ID)}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <GeofenceTreeNode
        node={tree}
        visibleGeofenceIds={visibleGeofenceIds}
        onToggleGeofence={handleToggleGeofence}
        onToggleFolder={handleToggleFolder}
        onCreateFolder={handleCreateFolder}
        onCreateGeofence={handleCreateGeofence}
        onEditFolder={handleEditFolder}
        onDeleteFolder={handleDeleteFolder}
        onDeleteGeofence={handleDeleteGeofence}
      />

      <GeofenceFolderDialog
        open={folderDialogOpen}
        folder={editingFolder}
        onClose={() => {
          setFolderDialogOpen(false);
          setEditingFolder(null);
        }}
        onSave={handleSaveFolder}
      />

      <GeofenceFolderDeleteDialog
        open={deleteFolderDialogOpen}
        folder={folderToDelete}
        onClose={() => {
          setDeleteFolderDialogOpen(false);
          setFolderToDelete(null);
        }}
        onConfirm={handleConfirmDeleteFolder}
      />

      <GeofenceTypeDialog
        open={typeDialogOpen}
        onClose={() => setTypeDialogOpen(false)}
        onSelect={handleSelectGeofenceType}
      />

      <GeofenceDeleteDialog
        open={deleteGeofenceDialogOpen}
        geofence={geofenceToDelete}
        onClose={() => {
          setDeleteGeofenceDialogOpen(false);
          setGeofenceToDelete(null);
        }}
        onConfirm={handleConfirmDeleteGeofence}
      />
    </Box>
  );
};

export default GeofenceTreeList;
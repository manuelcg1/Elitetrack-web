import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Collapse, IconButton, Tooltip, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import LinkIcon from '@mui/icons-material/Link';
import PublishIcon from '@mui/icons-material/Publish';
import ShareIcon from '@mui/icons-material/Share';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { useTranslation } from '../common/components/LocalizationProvider';

const ET = {
  green: '#00E65B',
  greenGlow: 'rgba(0,230,91,0.10)',
  silver: '#4A5056',
};

const INDENT_PX = 20;

const NodeAction = ({ title, icon, onClick }) => (
  <Tooltip title={title} arrow>
    <IconButton
      size="small"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {icon}
    </IconButton>
  </Tooltip>
);

const GroupTreeNode = ({
  node,
  showCommands = false,
  showShare = false,
  onDelete,
  defaultExpanded = false,
}) => {
  const navigate = useNavigate();
  const t = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded || node.depth === 0);

  const hasChildren = node.children.length > 0;

  const handleToggle = useCallback(
    (e) => {
      e.stopPropagation();
      if (hasChildren) setExpanded((prev) => !prev);
    },
    [hasChildren],
  );

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <Box
        sx={{
          width: '100%',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          pl: `${node.depth * INDENT_PX + 8}px`,
          pr: 1,
          py: 0.5,
          borderRadius: '8px',
          cursor: hasChildren ? 'pointer' : 'default',
          transition: 'background-color 0.15s',
          '&:hover': {
            backgroundColor: ET.greenGlow,
            '& .node-actions': { opacity: 1 },
          },
          '& .node-actions': { opacity: 0, transition: 'opacity 0.15s' },
        }}
        onClick={handleToggle}
      >
        {/* Chevron */}
        <Box sx={{ width: 24, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {hasChildren &&
            (expanded ? (
              <ExpandMoreIcon fontSize="small" sx={{ color: ET.green }} />
            ) : (
              <ChevronRightIcon fontSize="small" sx={{ color: ET.silver }} />
            ))}
        </Box>

        {/* Ícono carpeta */}
        <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
          {hasChildren && expanded ? (
            <FolderOpenIcon fontSize="small" sx={{ color: ET.green }} />
          ) : (
            <FolderIcon fontSize="small" sx={{ color: hasChildren ? ET.green : ET.silver }} />
          )}
        </Box>

        {/* Nombre */}
        <Typography
          variant="body2"
          noWrap
          title={node.name}
          sx={{
            flex: 1,
            minWidth: 0,
            fontWeight: node.depth === 0 ? 600 : 400,
            userSelect: 'none',
          }}
        >
          {node.name}
        </Typography>

        {/* Badge hijos */}
        {hasChildren && (
          <Typography
            variant="caption"
            sx={{
              mr: 1,
              px: 0.75,
              py: 0.2,
              borderRadius: '6px',
              backgroundColor: ET.greenGlow,
              color: ET.green,
              fontWeight: 600,
              fontSize: '0.7rem',
            }}
          >
            {node.children.length}
          </Typography>
        )}

        {/* Acciones en hover */}
        <Box className="node-actions" sx={{ display: 'flex', gap: 0.25 }}>
          <NodeAction
            title="Agregar subgrupo"
            icon={<AddIcon fontSize="small" />}
            onClick={() => navigate(`/settings/group?parentId=${node.id}`)}
          />
          <NodeAction
            title={t('sharedConnections')}
            icon={<LinkIcon fontSize="small" />}
            onClick={() => navigate(`/settings/group/${node.id}/connections`)}
          />
          {showCommands && (
            <NodeAction
              title={t('deviceCommand')}
              icon={<PublishIcon fontSize="small" />}
              onClick={() => navigate(`/settings/group/${node.id}/command`)}
            />
          )}
          {showShare && (
            <NodeAction
              title={t('sharedShare')}
              icon={<ShareIcon fontSize="small" />}
              onClick={() => navigate(`/settings/group/${node.id}/share`)}
            />
          )}
          <NodeAction
            title={t('sharedEdit')}
            icon={<EditIcon fontSize="small" />}
            onClick={() => navigate(`/settings/group/${node.id}`)}
          />
          <NodeAction
            title={t('sharedRemove')}
            icon={<DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />}
            onClick={() => onDelete(node.id)}
          />
        </Box>
      </Box>

      {/* Hijos */}
      {hasChildren && (
        <Collapse in={expanded} timeout={200}>
          <Box
            sx={{
              width: '100%',
              minWidth: 0,
              borderLeft: `2px solid ${ET.greenGlow}`,
              ml: `${node.depth * INDENT_PX + 20}px`,
            }}
          >
            {node.children.map((child) => (
              <GroupTreeNode
                key={child.id}
                node={child}
                showCommands={showCommands}
                showShare={showShare}
                onDelete={onDelete}
              />
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

export default GroupTreeNode;

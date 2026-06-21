import { useState, useCallback } from 'react';
import {
  Box,
  Collapse,
  IconButton,
  Tooltip,
  Typography,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import useGroupTree from './useGroupTree';

// ── Tokens de marca ───────────────────────────────────────────────────────────
const ET = {
  green:     '#00E65B',
  greenGlow: 'rgba(0,230,91,0.10)',
  silver:    '#8A9099',
};

const INDENT_PX = 16;

/**
 * Nodo individual del árbol de filtro — recursivo.
 */
const FilterNode = ({ node, selectedGroupId, onSelect }) => {
  const [expanded, setExpanded] = useState(node.depth === 0);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedGroupId === node.id;

  const handleToggle = useCallback((e) => {
    e.stopPropagation();
    if (hasChildren) setExpanded((prev) => !prev);
  }, [hasChildren]);

  const handleSelect = useCallback((e) => {
    e.stopPropagation();
    onSelect(isSelected ? null : node.id);
  }, [isSelected, node.id, onSelect]);

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          pl: `${node.depth * INDENT_PX + 4}px`,
          pr: 0.5,
          py: 0.4,
          borderRadius: '7px',
          cursor: 'pointer',
          backgroundColor: isSelected ? ET.greenGlow : 'transparent',
          border: isSelected ? `1px solid rgba(0,230,91,0.25)` : '1px solid transparent',
          transition: 'all 0.15s',
          '&:hover': { backgroundColor: ET.greenGlow },
        }}
        onClick={handleSelect}
      >
        {/* Chevron */}
        <Box
          sx={{ width: 20, flexShrink: 0, display: 'flex' }}
          onClick={handleToggle}
        >
          {hasChildren && (
            expanded
              ? <ExpandMoreIcon sx={{ fontSize: 16, color: ET.green }} />
              : <ChevronRightIcon sx={{ fontSize: 16, color: ET.silver }} />
          )}
        </Box>

        {/* Ícono carpeta */}
        <Box sx={{ mr: 0.75, display: 'flex', color: isSelected ? ET.green : ET.silver }}>
          {hasChildren && expanded
            ? <FolderOpenIcon sx={{ fontSize: 16 }} />
            : <FolderIcon sx={{ fontSize: 16 }} />
          }
        </Box>

        {/* Nombre */}
        <Typography
          variant="caption"
          sx={{
            flex: 1,
            fontWeight: isSelected ? 700 : node.depth === 0 ? 600 : 400,
            color: isSelected ? ET.green : 'text.primary',
            userSelect: 'none',
            lineHeight: 1.4,
          }}
        >
          {node.name}
        </Typography>

        {/* Badge hijos */}
        {hasChildren && (
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.65rem',
              fontWeight: 600,
              color: ET.silver,
              ml: 0.5,
            }}
          >
            {node.children.length}
          </Typography>
        )}
      </Box>

      {/* Hijos */}
      {hasChildren && (
        <Collapse in={expanded} timeout={150}>
          <Box sx={{ borderLeft: `1.5px solid ${ET.greenGlow}`, ml: `${node.depth * INDENT_PX + 12}px` }}>
            {node.children.map((child) => (
              <FilterNode
                key={child.id}
                node={child}
                selectedGroupId={selectedGroupId}
                onSelect={onSelect}
              />
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

/**
 * GroupFilter — Panel desplegable para filtrar dispositivos por grupo en el mapa.
 *
 * Props:
 * - selectedGroupId: number|null — grupo actualmente seleccionado
 * - onGroupSelect: (groupId|null) => void — callback al seleccionar/deseleccionar
 */
const GroupFilter = ({ selectedGroupId, onGroupSelect }) => {
  const [open, setOpen] = useState(false);
  const { tree } = useGroupTree();

  if (tree.length === 0) return null;

  const selectedNode = selectedGroupId
    ? tree.flatMap((n) => {
        const collect = (node) => [node, ...node.children.flatMap(collect)];
        return collect(n);
      }).find((n) => n.id === selectedGroupId)
    : null;

  return (
    <Box>
      {/* Botón toggle del filtro */}
      <Tooltip title="Filtrar por grupo" arrow>
        <IconButton
          size="small"
          onClick={() => setOpen((prev) => !prev)}
          sx={{
            color: selectedGroupId ? ET.green : 'inherit',
            backgroundColor: selectedGroupId ? ET.greenGlow : 'transparent',
          }}
        >
          <FilterListIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Panel del árbol */}
      <Collapse in={open} timeout={200}>
        <Box
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 10,
            backgroundColor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '0 0 10px 10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            maxHeight: 320,
            overflowY: 'auto',
            p: 1,
          }}
        >
          {/* Chip del filtro activo */}
          {selectedNode && (
            <Box sx={{ mb: 1 }}>
              <Chip
                size="small"
                label={`Filtro: ${selectedNode.name}`}
                onDelete={() => onGroupSelect(null)}
                deleteIcon={<CloseIcon />}
                sx={{
                  backgroundColor: ET.greenGlow,
                  color: ET.green,
                  fontWeight: 600,
                  fontSize: '0.72rem',
                }}
              />
            </Box>
          )}

          {/* Árbol */}
          {tree.map((node) => (
            <FilterNode
              key={node.id}
              node={node}
              selectedGroupId={selectedGroupId}
              onSelect={onGroupSelect}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

export default GroupFilter;

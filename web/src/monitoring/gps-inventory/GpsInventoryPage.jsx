import { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Fab,
  CircularProgress,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../common/components/PageLayout';
import MonitoringMenu from '../MonitoringMenu';
import GpsStatusBadge from './GpsStatusBadge';
import GpsFormDialog from './GpsFormDialog';
import useGpsInventory from './useGpsInventory';
import { GPS_STATUS_META, GPS_BRANDS } from './gpsConstants';

const ET = { green: '#00E65B' };

/**
 * GpsInventoryPage — Listado del inventario de GPS.
 *
 * Sigue el patrón de DevicesPage/GroupsPage: tabla + buscador + FAB.
 * Permite crear, editar y eliminar GPS, y acceder a su historial
 * de trazabilidad (módulo de ciclo de vida).
 */
const GpsInventoryPage = () => {
  const navigate = useNavigate();
  const { loading, error, createGps, updateGps, deleteGps } = useGpsInventory();

  const items = useSelector((state) => state.gpsInventory.items);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGps, setEditingGps] = useState(null);

  // ── Filtrado en memoria ────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    return Object.values(items)
      .filter((gps) => {
        const matchesSearch = !search
          || gps.imei?.includes(search)
          || gps.serialNumber?.toLowerCase().includes(lowerSearch);
        const matchesStatus = !statusFilter || gps.status === statusFilter;
        const matchesBrand = !brandFilter || gps.brand === brandFilter;
        return matchesSearch && matchesStatus && matchesBrand;
      })
      .sort((a, b) => (a.imei || '').localeCompare(b.imei || ''));
  }, [items, search, statusFilter, brandFilter]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreate = () => {
    setEditingGps(null);
    setDialogOpen(true);
  };

  const handleEdit = (gps) => {
    setEditingGps(gps);
    setDialogOpen(true);
  };

  const handleSave = async (gpsData) => {
    if (gpsData.id) {
      await updateGps(gpsData);
    } else {
      await createGps(gpsData);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este GPS del inventario? Esta acción no se puede deshacer.')) {
      return;
    }
    await deleteGps(id);
  };

  const handleViewHistory = (gpsId) => {
    navigate(`/monitoring/gps-inventory/${gpsId}/history`);
  };

  const getBrandLabel = (value) =>
    GPS_BRANDS.find((b) => b.value === value)?.label || value;

  return (
    <PageLayout
      menu={<MonitoringMenu />}
      breadcrumbs={['monitoringTitle', 'gpsInventoryTitle']}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* ── Barra de filtros ── */}
        <Box sx={{ display: 'flex', gap: 1.5, p: 2, borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Buscar por IMEI o serie"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 240 }}
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

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Estado</InputLabel>
            <Select
              label="Estado"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {Object.entries(GPS_STATUS_META).map(([value, meta]) => (
                <MenuItem key={value} value={value}>{meta.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Marca</InputLabel>
            <Select
              label="Marca"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
            >
              <MenuItem value="">Todas</MenuItem>
              {GPS_BRANDS.map((brand) => (
                <MenuItem key={brand.value} value={brand.value}>{brand.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* ── Contenido ── */}
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
              <CircularProgress size={32} />
            </Box>
          )}

          {!loading && error && (
            <Box sx={{ p: 3 }}>
              <Typography color="error">{error}</Typography>
            </Box>
          )}

          {!loading && !error && filteredItems.length === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 6, gap: 1, color: 'text.secondary' }}>
              <Typography variant="body2">
                {search || statusFilter || brandFilter
                  ? 'No se encontraron resultados'
                  : 'No hay dispositivos GPS registrados'}
              </Typography>
              {!search && !statusFilter && !brandFilter && (
                <Typography variant="caption">
                  Agrega tu primer GPS con el botón +
                </Typography>
              )}
            </Box>
          )}

          {!loading && !error && filteredItems.length > 0 && (
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>IMEI</TableCell>
                  <TableCell>Marca</TableCell>
                  <TableCell>Modelo</TableCell>
                  <TableCell>N° Serie</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredItems.map((gps) => (
                  <TableRow key={gps.id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {gps.imei}
                    </TableCell>
                    <TableCell>{getBrandLabel(gps.brand)}</TableCell>
                    <TableCell>{gps.model || '—'}</TableCell>
                    <TableCell>{gps.serialNumber || '—'}</TableCell>
                    <TableCell>
                      <GpsStatusBadge status={gps.status} />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Historial / Trazabilidad">
                        <IconButton size="small" onClick={() => handleViewHistory(gps.id)}>
                          <HistoryIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => handleEdit(gps)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton size="small" onClick={() => handleDelete(gps.id)}>
                          <DeleteIcon fontSize="small" color="error" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>

        {/* ── FAB crear ── */}
        <Fab
          size="medium"
          onClick={handleCreate}
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

      {/* ── Formulario ── */}
      <GpsFormDialog
        open={dialogOpen}
        gps={editingGps}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
    </PageLayout>
  );
};

export default GpsInventoryPage;

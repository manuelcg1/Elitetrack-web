import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import fetchOrThrow from '../common/util/fetchOrThrow';

const countTypes = (items) =>
  items.reduce((result, item) => ({ ...result, [item.type]: (result[item.type] || 0) + 1 }), {});

const KmlImportDialog = ({ open, plan, baseFolderId, onClose, onImported }) => {
  const [recoverMissing, setRecoverMissing] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  const selectedGeofences = useMemo(
    () => plan?.geofences.filter((item) => recoverMissing || !item.recovered) || [],
    [plan, recoverMissing],
  );
  const counts = useMemo(() => countTypes(selectedGeofences), [selectedGeofences]);
  const recoveredCount = plan?.geofences.filter((item) => item.recovered).length || 0;

  const handleImport = async () => {
    setImporting(true);
    setResult(null);
    const folderIds = new Map();
    const createdFolders = [];
    const createdGeofences = [];
    let completed = 0;
    const total = plan.folders.length + selectedGeofences.length;

    try {
      for (const folder of plan.folders) {
        if (folder.parentKey && !folderIds.has(folder.parentKey)) {
          throw new Error(`${folder.name}: no se pudo crear su carpeta padre.`);
        }
        const response = await fetchOrThrow('/api/geofenceFolders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: folder.name,
            description: folder.description,
            parentid: folder.parentKey ? folderIds.get(folder.parentKey) : baseFolderId,
            attributes: {},
          }),
        });
        const createdFolder = await response.json();
        folderIds.set(folder.key, createdFolder.id);
        createdFolders.push(createdFolder.id);
        completed += 1;
        setProgress(total ? (completed / total) * 100 : 100);
      }

      for (const geofence of selectedGeofences) {
        const folderId = geofence.folderKey ? folderIds.get(geofence.folderKey) : baseFolderId;
        if (geofence.folderKey && !folderId) {
          throw new Error(`${geofence.name}: no se pudo crear su carpeta.`);
        }
        const response = await fetchOrThrow('/api/geofences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: geofence.name,
            description: geofence.description,
            area: geofence.area,
            attributes: {
              folderId: folderId || 0,
              ...(geofence.color ? { color: geofence.color } : {}),
              ...(geofence.fullDescription.length > geofence.description.length
                ? { kmlDescription: geofence.fullDescription.slice(0, 3000) }
                : {}),
            },
          }),
        });
        createdGeofences.push((await response.json()).id);
        completed += 1;
        setProgress(total ? (completed / total) * 100 : 100);
      }

      setResult({ imported: total, failures: [], rolledBack: false });
      onImported?.();
    } catch (error) {
      const rollbackFailures = [];

      for (const id of [...createdGeofences].reverse()) {
        try {
          await fetchOrThrow(`/api/geofences/${id}`, { method: 'DELETE' });
        } catch (rollbackError) {
          rollbackFailures.push(`Geo-zona ${id}: ${rollbackError.message}`);
        }
      }
      for (const id of [...createdFolders].reverse()) {
        try {
          await fetchOrThrow(`/api/geofenceFolders/${id}`, { method: 'DELETE' });
        } catch (rollbackError) {
          rollbackFailures.push(`Carpeta ${id}: ${rollbackError.message}`);
        }
      }

      setResult({
        imported: rollbackFailures.length,
        failures: [
          { name: 'Importación cancelada', error: error.message },
          ...rollbackFailures.map((rollbackError) => ({
            name: 'Reversión incompleta',
            error: rollbackError,
          })),
        ],
        rolledBack: rollbackFailures.length === 0,
      });
      onImported?.();
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      setResult(null);
      setProgress(0);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Importar archivo KML</DialogTitle>
      <DialogContent>
        {plan && (
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                {plan.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {plan.folders.length} carpetas · {selectedGeofences.length} geo-zonas
              </Typography>
            </Box>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Typography variant="body2">Círculos: {counts.Point || 0}</Typography>
              <Typography variant="body2">Líneas: {counts.LineString || 0}</Typography>
              <Typography variant="body2">Polígonos: {counts.Polygon || 0}</Typography>
            </Stack>
            {recoveredCount > 0 && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={recoverMissing}
                    onChange={(event) => setRecoverMissing(event.target.checked)}
                    disabled={importing}
                  />
                }
                label={`Recuperar ${recoveredCount} puntos desde sus coordenadas descriptivas`}
              />
            )}
            {plan.omitted.length > 0 && (
              <Alert severity="warning">
                Se omitirán {plan.omitted.length} elementos sin geometría recuperable.
              </Alert>
            )}
            <Alert severity="info">
              Los puntos se crearán como círculos de 25 metros. Las coordenadas de líneas y
              polígonos no se simplificarán.
            </Alert>
            {importing && <LinearProgress variant="determinate" value={progress} />}
            {result && (
              <Alert severity={result.failures.length ? 'warning' : 'success'}>
                {result.rolledBack
                  ? 'La importación falló y todos los elementos creados fueron revertidos.'
                  : `Se crearon ${result.imported} elementos. Fallidos: ${result.failures.length}.`}
                {result.failures.length > 0 && (
                  <Box component="ul" sx={{ my: 0.5, pl: 2.5 }}>
                    {result.failures.slice(0, 5).map((failure, index) => (
                      <li key={`${failure.name}-${index}`}>
                        {failure.name}: {failure.error}
                      </li>
                    ))}
                    {result.failures.length > 5 && (
                      <li>Y {result.failures.length - 5} errores adicionales.</li>
                    )}
                  </Box>
                )}
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={importing}>
          {result ? 'Cerrar' : 'Cancelar'}
        </Button>
        {!result && (
          <Button variant="contained" onClick={handleImport} disabled={importing || !plan}>
            Importar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default KmlImportDialog;

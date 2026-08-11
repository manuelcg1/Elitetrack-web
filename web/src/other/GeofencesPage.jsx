import { useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Box,
  Button,
  Divider,
  Typography,
  IconButton,
  Toolbar,
  Paper,
  TextField,
} from '@mui/material';
import Tooltip from '@mui/material/Tooltip';
import { makeStyles } from 'tss-react/mui';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MapView from '../map/core/MapView';
import MapCurrentLocation from '../map/MapCurrentLocation';
import MapGeofenceEdit from '../map/draw/MapGeofenceEdit';
import GeofenceTreeList from './GeofenceTreeList';
import { useTranslation } from '../common/components/LocalizationProvider';
import MapGeocoder from '../map/geocoder/MapGeocoder';
import { errorsActions, geofencesActions } from '../store';
import MapScale from '../map/MapScale';
import BackIcon from '../common/components/BackIcon';
import fetchOrThrow from '../common/util/fetchOrThrow';
import KmlImportDialog from './KmlImportDialog';
import { parseKml } from './kmlImport';

const MAX_GEOFENCE_NAME_LENGTH = 128;

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    flexGrow: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'row',
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column-reverse',
    },
  },
  drawer: {
    display: 'flex',
    flexDirection: 'column',
    [theme.breakpoints.up('sm')]: {
      width: theme.dimensions.drawerWidthDesktop,
    },
    [theme.breakpoints.down('sm')]: {
      height: theme.dimensions.drawerHeightPhone,
    },
  },
  mapContainer: {
    flexGrow: 1,
  },
  title: {
    flexGrow: 1,
  },
  fileInput: {
    display: 'none',
  },
}));

const GeofencesPage = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useTranslation();
  const [searchParams] = useSearchParams();

  const folderId = Number(searchParams.get('folderId') || 0);
  const geofenceType = searchParams.get('type');

  const [selectedGeofenceId, setSelectedGeofenceId] = useState();
  const [circleCenter, setCircleCenter] = useState(null);
  const [circleRadius, setCircleRadius] = useState(100);
  const [circleName, setCircleName] = useState('');
  const [savingCircle, setSavingCircle] = useState(false);
  const [editingCircle, setEditingCircle] = useState(null);
  const [kmlPlan, setKmlPlan] = useState(null);
  const [importVersion, setImportVersion] = useState(0);
  const circleMode = geofenceType === 'circle' || !!editingCircle;

  const handleEditCircle = (geofence) => {
    const values = geofence.area
      .replace(/CIRCLE|\(|\)|,/g, ' ')
      .trim()
      .split(/ +/)
      .map(Number);
    if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) {
      dispatch(errorsActions.push('La geometría circular no es válida.'));
      return;
    }
    setEditingCircle(geofence);
    setCircleName(geofence.name || '');
    setCircleCenter({ latitude: values[0], longitude: values[1] });
    setCircleRadius(values[2]);
  };

  const closeCircleEditor = () => {
    if (geofenceType === 'circle') {
      navigate('/geofences', { replace: true });
    } else {
      setEditingCircle(null);
      setCircleCenter(null);
      setCircleRadius(100);
      setCircleName('');
    }
  };

  const handleBack = () => {
    if (circleMode) {
      closeCircleEditor();
    } else {
      navigate('/settings/preferences?menu=true');
    }
  };

  const handleSaveCircle = async () => {
    if (
      !circleName.trim() ||
      !circleCenter ||
      !Number.isFinite(circleRadius) ||
      circleRadius <= 0
    ) {
      return;
    }
    setSavingCircle(true);
    try {
      const response = await fetchOrThrow(
        editingCircle ? `/api/geofences/${editingCircle.id}` : '/api/geofences',
        {
          method: editingCircle ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(editingCircle || { attributes: { folderId } }),
            name: circleName.trim().slice(0, MAX_GEOFENCE_NAME_LENGTH),
            area: `CIRCLE (${circleCenter.latitude} ${circleCenter.longitude}, ${circleRadius})`,
          }),
        },
      );
      const item = await response.json();
      dispatch(geofencesActions.update([item]));
      closeCircleEditor();
    } catch (error) {
      dispatch(errorsActions.push(error.message));
    } finally {
      setSavingCircle(false);
    }
  };

  const handleFile = (event) => {
    const files = Array.from(event.target.files);
    const [file] = files;
    event.target.value = '';
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.kml')) {
      file
        .text()
        .then((content) => setKmlPlan(parseKml(content)))
        .catch((error) => dispatch(errorsActions.push(error.message)));
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const xml = new DOMParser().parseFromString(reader.result, 'text/xml');
      const segment = xml.getElementsByTagName('trkseg')[0];
      const coordinates = Array.from(segment.getElementsByTagName('trkpt'))
        .map((point) => `${point.getAttribute('lat')} ${point.getAttribute('lon')}`)
        .join(', ');
      const area = `LINESTRING (${coordinates})`;
      const newItem = {
        name: t('sharedGeofence'),
        area,
        attributes: {
          folderId,
        },
      };
      try {
        const response = await fetchOrThrow('/api/geofences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem),
        });
        const item = await response.json();
        navigate(`/settings/geofence/${item.id}`);
      } catch (error) {
        dispatch(errorsActions.push(error.message));
      }
    };
    reader.onerror = (event) => {
      dispatch(errorsActions.push(event.target.error));
    };
    reader.readAsText(file);
  };

  return (
    <div className={classes.root}>
      <div className={classes.content}>
        <Paper square className={classes.drawer}>
          <Toolbar>
            <IconButton edge="start" sx={{ mr: 2 }} onClick={handleBack}>
              <BackIcon />
            </IconButton>
            <Typography variant="h6" className={classes.title}>
              {t('sharedGeofences')}
            </Typography>
            <label htmlFor="upload-geofence">
              <input
                accept=".gpx,.kml"
                id="upload-geofence"
                type="file"
                className={classes.fileInput}
                onChange={handleFile}
              />
              <IconButton edge="end" component="span" onClick={() => {}}>
                <Tooltip title={t('sharedUpload')}>
                  <UploadFileIcon />
                </Tooltip>
              </IconButton>
            </label>
          </Toolbar>
          <Divider />
          {circleMode ? (
            <Box sx={{ p: 2, overflow: 'auto' }}>
              <Typography variant="h6" gutterBottom>
                {editingCircle ? `Editar ${editingCircle.name}` : 'Nueva geo-zona circular'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Selecciona el centro en el mapa y define el radio necesario.
              </Typography>
              <TextField
                fullWidth
                label="Nombre"
                value={circleName}
                onChange={(event) => setCircleName(event.target.value)}
                slotProps={{ htmlInput: { maxLength: MAX_GEOFENCE_NAME_LENGTH } }}
                error={!circleName.trim()}
                helperText={!circleName.trim() ? 'Ingresa un nombre.' : ' '}
                sx={{ mb: 1 }}
              />
              <TextField
                fullWidth
                type="number"
                label="Radio (metros)"
                value={circleRadius}
                onChange={(event) => setCircleRadius(Number(event.target.value))}
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
                error={!Number.isFinite(circleRadius) || circleRadius <= 0}
                helperText={
                  !Number.isFinite(circleRadius) || circleRadius <= 0
                    ? 'Ingresa un radio mayor que cero.'
                    : 'La previsualización se actualiza automáticamente.'
                }
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Latitud"
                value={circleCenter?.latitude ?? ''}
                slotProps={{ input: { readOnly: true } }}
                sx={{ mb: 1.5 }}
              />
              <TextField
                fullWidth
                label="Longitud"
                value={circleCenter?.longitude ?? ''}
                slotProps={{ input: { readOnly: true } }}
                sx={{ mb: 2 }}
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                {circleCenter
                  ? 'Haz clic en otro punto del mapa para cambiar el centro.'
                  : 'Haz clic en el mapa para establecer el centro.'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button onClick={closeCircleEditor} disabled={savingCircle}>
                  Cancelar
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSaveCircle}
                  disabled={
                    savingCircle ||
                    !circleName.trim() ||
                    !circleCenter ||
                    !Number.isFinite(circleRadius) ||
                    circleRadius <= 0
                  }
                >
                  Guardar geo-zona
                </Button>
              </Box>
            </Box>
          ) : (
            <GeofenceTreeList
              key={importVersion}
              onGeofenceSelected={setSelectedGeofenceId}
              onEditCircle={handleEditCircle}
            />
          )}
        </Paper>

        <div className={classes.mapContainer}>
          <MapView>
            <MapGeofenceEdit
              selectedGeofenceId={selectedGeofenceId}
              folderId={folderId}
              geofenceType={circleMode ? 'circle' : geofenceType}
              circleCenter={circleCenter}
              circleRadius={circleRadius}
              onCircleCenterChange={setCircleCenter}
            />
          </MapView>
          <MapScale />
          <MapCurrentLocation />
          <MapGeocoder />
        </div>
      </div>
      <KmlImportDialog
        open={!!kmlPlan}
        plan={kmlPlan}
        baseFolderId={folderId}
        onClose={() => setKmlPlan(null)}
        onImported={() => setImportVersion((value) => value + 1)}
      />
    </div>
  );
};

export default GeofencesPage;

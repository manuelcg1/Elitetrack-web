import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  useTheme,
} from '@mui/material';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import ReportFilter, { updateReportParams } from './components/ReportFilter';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import PositionValue from '../common/components/PositionValue';
import GeofenceVisitCell from './components/GeofenceVisitCell';
import useGeofenceNames from './common/useGeofenceNames';
import useReadableGeofences from './common/useReadableGeofences';
import GeofenceVisibilityPanel from './components/GeofenceVisibilityPanel';
import ColumnSelect from './components/ColumnSelect';
import RouteColorSelect, { isRouteColor } from './components/RouteColorSelect';
import usePositionAttributes from '../common/attributes/usePositionAttributes';
import { useCatch } from '../reactHelper';
import * as maplibregl from 'maplibre-gl';
import MapView, { map } from '../map/core/MapView';
import MapRoutePath from '../map/MapRoutePath';
import MapRoutePoints from '../map/MapRoutePoints';
import MapPositions from '../map/MapPositions';
import useReportStyles from './common/useReportStyles';
import TableShimmer from '../common/components/TableShimmer';
import MapCamera from '../map/MapCamera';
import MapGeofence from '../map/MapGeofence';
import MapGeofenceControl from '../map/MapGeofenceControl';
import { geofenceToFeature } from '../map/core/mapUtil';
import scheduleReport from './common/scheduleReport';
import MapScale from '../map/MapScale';
import fetchOrThrow from '../common/util/fetchOrThrow';
import SelectField from '../common/components/SelectField';
import ReportMapSplit from './components/ReportMapSplit';
import usePersistedState from '../common/util/usePersistedState';
import exportExcel from '../common/util/exportExcel';
import { useAttributePreference, usePreference } from '../common/util/preferences';
import { speedToKnots } from '../common/util/converter';
import {
  formatAlarm,
  formatAltitude,
  formatBoolean,
  formatConsumption,
  formatCoordinate,
  formatCourse,
  formatDistance,
  formatNumber,
  formatNumericHours,
  formatPercentage,
  formatSpeed,
  formatTemperature,
  formatTime,
  formatVoltage,
  formatVolume,
  formatAddress,
} from '../common/util/formatter';

// La tabla puede tener miles de filas; memo evita redibujarla al cambiar el color de la ruta.
const PositionsTable = memo((props) => {
  const { items, columns, loading, selectedItem, onSelect, onClear, geofenceNames } = props;
  const { classes } = useReportStyles();
  const t = useTranslation();
  const positionAttributes = usePositionAttributes(t);

  const selectedRef = useRef();

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [selectedItem]);

  return (
    <Table className={classes.compactTable}>
      <TableHead>
        <TableRow>
          <TableCell className={classes.columnAction} />
          {columns.map((key) => (
            <TableCell key={key}>{positionAttributes[key]?.name || key}</TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {!loading ? (
          items.slice(0, 4000).map((item, index) => (
            <TableRow
              key={item.id}
              hover
              selected={selectedItem?.id === item.id}
              onClick={() => onSelect(item)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(item);
                }
              }}
              tabIndex={0}
              sx={{ cursor: 'pointer' }}
            >
              <TableCell className={classes.columnAction} padding="none">
                {selectedItem?.id === item.id ? (
                  <IconButton
                    size="small"
                    aria-label="Ocultar ubicación seleccionada"
                    onClick={(event) => {
                      event.stopPropagation();
                      onClear();
                    }}
                    ref={selectedRef}
                  >
                    <GpsFixedIcon fontSize="small" />
                  </IconButton>
                ) : (
                  <IconButton
                    size="small"
                    aria-label="Mostrar ubicación en el mapa"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(item);
                    }}
                  >
                    <LocationSearchingIcon fontSize="small" />
                  </IconButton>
                )}
              </TableCell>
              {columns.map((key) => (
                <TableCell key={key}>
                  {key === 'geofenceIds' ? (
                    <GeofenceVisitCell
                      current={item.geofenceIds}
                      previous={
                        index > 0 && items[index - 1].deviceId === item.deviceId
                          ? items[index - 1].geofenceIds
                          : undefined
                      }
                      names={geofenceNames}
                    />
                  ) : (
                    <PositionValue
                      position={item}
                      property={item.hasOwnProperty(key) ? key : null}
                      attribute={item.hasOwnProperty(key) ? null : key}
                    />
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableShimmer columns={columns.length + 1} startAction />
        )}
      </TableBody>
    </Table>
  );
});

PositionsTable.displayName = 'PositionsTable';

const PositionsReportPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { classes } = useReportStyles();
  const t = useTranslation();

  const distanceUnit = useAttributePreference('distanceUnit');
  const altitudeUnit = useAttributePreference('altitudeUnit');
  const speedUnit = useAttributePreference('speedUnit');
  const volumeUnit = useAttributePreference('volumeUnit');
  const coordinateFormat = usePreference('coordinateFormat');

  const [searchParams, setSearchParams] = useSearchParams();

  const positionAttributes = usePositionAttributes(t);

  const [available, setAvailable] = useState([]);
  const [columns, setColumns] = useState(['fixTime', 'latitude', 'longitude', 'speed', 'address']);
  const [storedColor, setLineColor] = usePersistedState('reportPositionsLineColor', null);
  const lineColor = isRouteColor(storedColor) ? storedColor : null;
  const deviceId = searchParams.get('deviceId');
  const deviceColor = useSelector(
    (state) => state.devices.items[deviceId]?.attributes?.['web.reportColor'],
  );
  const [items, setItems] = useState([]);
  // Parámetros de la última consulta y si traía las geocercas calculadas en el servidor.
  const [loaded, setLoaded] = useState(null);
  // Geocercas del mapa: del recorrido (calculadas en el servidor), elegidas o ninguna.
  const [geofenceMode, setGeofenceMode] = usePersistedState('reportPositionsGeofenceMode', 'route');
  const [chosenGeofences, setChosenGeofences] = usePersistedState('reportPositionsGeofenceIds', []);
  const [geofenceLabels, setGeofenceLabels] = usePersistedState(
    'reportPositionsGeofenceLabels',
    true,
  );
  const [geofenceAnchor, setGeofenceAnchor] = useState(null);
  const readableGeofences = useReadableGeofences();
  const withGeofences = columns.includes('geofenceIds') || geofenceMode === 'route';
  const geofenceNames = useGeofenceNames(readableGeofences);
  const geofenceId = searchParams.has('geofenceId')
    ? parseInt(searchParams.get('geofenceId'))
    : null;
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectionVersion, setSelectionVersion] = useState(0);

  const selectItem = useCallback((item) => {
    setSelectedItem(item);
    setSelectionVersion((current) => current + 1);
  }, []);

  const clearItem = useCallback(() => setSelectedItem(null), []);

  const routes = useMemo(
    () =>
      [...new Set(items.map((it) => it.deviceId))].map((id) => [
        id,
        items.filter((position) => position.deviceId === id),
      ]),
    [items],
  );

  const routeGeofenceIds = useMemo(
    () => new Set(items.flatMap((position) => position.geofenceIds || [])),
    [items],
  );

  const visibleGeofenceIds = useMemo(() => {
    if (geofenceMode === 'route') return routeGeofenceIds;
    if (geofenceMode === 'custom') return new Set(chosenGeofences);
    return new Set();
  }, [geofenceMode, routeGeofenceIds, chosenGeofences]);

  const visibleGeofences = useMemo(
    () => readableGeofences.geofences.filter((geofence) => visibleGeofenceIds.has(geofence.id)),
    [readableGeofences.geofences, visibleGeofenceIds],
  );

  const onChosenGeofences = useCallback(
    (ids) => {
      setChosenGeofences(ids);
      setGeofenceMode('custom');
    },
    [setChosenGeofences, setGeofenceMode],
  );

  const onGeofenceMode = useCallback(
    (value) => {
      // Al pasar a "Elegidas" se parte de lo que ya se veía si no había nada elegido.
      if (value === 'custom' && !chosenGeofences.length) {
        setChosenGeofences([...visibleGeofenceIds]);
      }
      setGeofenceMode(value);
    },
    [chosenGeofences, visibleGeofenceIds, setChosenGeofences, setGeofenceMode],
  );

  const fitBounds = (coordinates) => {
    if (coordinates.length) {
      const bounds = coordinates.reduce(
        (result, item) => result.extend(item),
        new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
      );
      const canvas = map.getCanvas();
      map.fitBounds(bounds, {
        padding: Math.min(canvas.clientWidth, canvas.clientHeight) * 0.12,
        maxZoom: 17,
      });
    }
  };

  const onGeofenceZoom = useCallback(
    (geofence) => {
      const { geometry } = geofenceToFeature(theme, geofence);
      const flatten = (value) => (typeof value[0] === 'number' ? [value] : value.flatMap(flatten));
      fitBounds(flatten(geometry.coordinates));
    },
    [theme],
  );

  const onFitRoute = useCallback(() => {
    fitBounds(items.map((item) => [item.longitude, item.latitude]));
  }, [items]);

  const onMapPointClick = useCallback(
    (positionId) => {
      const item = items.find((it) => it.id === positionId);
      if (item) {
        selectItem(item);
      }
    },
    [items, selectItem],
  );

  const load = useCatch(async ({ deviceIds, from, to }, geofences) => {
    const query = new URLSearchParams({ from, to });
    if (geofences) {
      query.append('geofences', 'true');
    }
    if (geofenceId) {
      query.append('geofenceId', geofenceId);
    }
    deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
    setSelectedItem(null);
    setLoading(true);
    try {
      const response = await fetchOrThrow(`/api/positions?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      const data = await response.json();
      const keySet = new Set();
      const keyList = [];
      data.forEach((position) => {
        Object.keys(position).forEach((it) => keySet.add(it));
        Object.keys(position.attributes).forEach((it) => keySet.add(it));
      });
      // Geo-Zonas se calcula en el servidor, por eso se ofrece aunque ninguna posición la traiga guardada.
      keySet.add('geofenceIds');
      ['id', 'deviceId', 'outdated', 'network', 'attributes'].forEach((key) => keySet.delete(key));
      Object.keys(positionAttributes).forEach((key) => {
        if (keySet.has(key)) {
          keyList.push(key);
          keySet.delete(key);
        }
      });
      setAvailable(
        [...keyList, ...keySet].map((key) => [key, positionAttributes[key]?.name || key]),
      );
      setItems(data);
      setLoaded({ params: { deviceIds, from, to }, geofences });
    } finally {
      setLoading(false);
    }
  });

  const onShow = (params) => load(params, withGeofences);

  // Si se activa Geo-Zonas después de consultar, se vuelve a pedir con el cálculo.
  useEffect(() => {
    if (withGeofences && loaded && !loaded.geofences && !loading) {
      load(loaded.params, true);
    }
  }, [withGeofences, loaded]);

  const formatExportValue = (position, key) => {
    const value = position.hasOwnProperty(key) ? position[key] : position.attributes?.[key];
    if (key === 'address') {
      return formatAddress(position, coordinateFormat);
    }
    if (key === 'geofenceIds') {
      return (value || []).map((id) => geofenceNames[id] || id).join(', ');
    }
    if (value == null) {
      return '';
    }
    switch (key) {
      case 'fixTime':
      case 'deviceTime':
      case 'serverTime':
        return formatTime(value, 'seconds');
      case 'latitude':
      case 'longitude':
        return formatCoordinate(key, value, coordinateFormat);
      case 'obdSpeed':
        return formatSpeed(speedToKnots(value, 'kmh'), speedUnit, t);
      case 'course':
        return formatCourse(value);
      case 'altitude':
        return formatAltitude(value, altitudeUnit, t);
      case 'fuelConsumption':
        return formatConsumption(value, t);
      case 'coolantTemp':
        return formatTemperature(value);
      case 'alarm':
        return formatAlarm(value, t);
      default:
        switch (positionAttributes[key]?.dataType) {
          case 'speed':
            return formatSpeed(value, speedUnit, t);
          case 'distance':
            return formatDistance(value, distanceUnit, t);
          case 'voltage':
            return formatVoltage(value, t);
          case 'percentage':
            return formatPercentage(value);
          case 'volume':
            return formatVolume(value, volumeUnit, t);
          case 'hours':
            return formatNumericHours(value, t);
          default:
            if (typeof value === 'number') {
              return formatNumber(value);
            }
            if (typeof value === 'boolean') {
              return formatBoolean(value, t);
            }
            if (Array.isArray(value)) {
              return value.join(', ');
            }
            if (typeof value === 'object') {
              return JSON.stringify(value);
            }
            return value;
        }
    }
  };

  const onExport = useCatch(async () => {
    const rows = items.slice(0, 4000).map((position) => {
      const row = {};
      columns.forEach((key) => {
        row[positionAttributes[key]?.name || key] = formatExportValue(position, key);
      });
      return row;
    });
    if (!rows.length) {
      return;
    }
    await exportExcel(
      t('reportPositions'),
      'positions.xlsx',
      new Map([[t('reportPositions'), rows]]),
      theme,
    );
  });

  const onSchedule = useCatch(async (deviceIds, groupIds, report) => {
    report.type = 'route';
    await scheduleReport(deviceIds, groupIds, report);
    navigate('/reports/scheduled');
  });

  const mapPanel = items.length ? (
    <div className={classes.containerMap}>
      <MapView>
        <MapGeofence items={visibleGeofences} labels={geofenceLabels} />
        <MapGeofenceControl
          count={visibleGeofenceIds.size}
          open={Boolean(geofenceAnchor)}
          label={t('reportGeofencesPanel')}
          onClick={(element) => setGeofenceAnchor((current) => (current ? null : element))}
        />
        {routes.map(([id, positions]) => (
          <Fragment key={id}>
            <MapRoutePath positions={positions} color={lineColor} />
            <MapRoutePoints positions={positions} onClick={onMapPointClick} color={lineColor} />
          </Fragment>
        ))}
        {selectedItem && <MapPositions positions={[selectedItem]} titleField="fixTime" />}
        {selectedItem ? (
          <MapCamera
            key={selectionVersion}
            latitude={selectedItem.latitude}
            longitude={selectedItem.longitude}
          />
        ) : (
          <MapCamera positions={items} />
        )}
      </MapView>
      <MapScale />
      <GeofenceVisibilityPanel
        open={Boolean(geofenceAnchor)}
        anchorEl={geofenceAnchor}
        onClose={() => setGeofenceAnchor(null)}
        loaded={readableGeofences.loaded}
        folders={readableGeofences.folders}
        geofences={readableGeofences.geofences}
        routeIds={routeGeofenceIds}
        mode={geofenceMode}
        onMode={onGeofenceMode}
        visibleIds={visibleGeofenceIds}
        onChosen={onChosenGeofences}
        labels={geofenceLabels}
        onLabels={setGeofenceLabels}
        onZoom={onGeofenceZoom}
        onFitRoute={onFitRoute}
      />
    </div>
  ) : null;

  const tablePanel = (
    <div className={classes.containerMain}>
      <div className={classes.header}>
        <ReportFilter
          onShow={onShow}
          onExport={onExport}
          onSchedule={onSchedule}
          deviceType="single"
          loading={loading}
          wrap
        >
          <div className={classes.filterGeofence}>
            <SelectField
              value={geofenceId}
              onChange={(e) => {
                const values = e.target.value ? [e.target.value] : [];
                updateReportParams(searchParams, setSearchParams, 'geofenceId', values);
              }}
              endpoint="/api/geofences"
              label={t('sharedGeofence')}
              fullWidth
            />
          </div>
          <ColumnSelect
            columns={columns}
            setColumns={setColumns}
            columnsArray={available}
            rawValues
            disabled={!items.length}
          />
          <RouteColorSelect value={lineColor} onChange={setLineColor} deviceColor={deviceColor} />
        </ReportFilter>
      </div>
      <PositionsTable
        items={items}
        columns={columns}
        loading={loading}
        selectedItem={selectedItem}
        onSelect={selectItem}
        onClear={clearItem}
        geofenceNames={geofenceNames}
      />
    </div>
  );

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportPositions']}>
      <div className={classes.container}>
        <ReportMapSplit
          mapPanel={mapPanel}
          contentPanel={tablePanel}
          storageKey="reportPositionsSplitHeight"
        />
      </div>
    </PageLayout>
  );
};

export default PositionsReportPage;

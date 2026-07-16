import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
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
import ColumnSelect from './components/ColumnSelect';
import usePositionAttributes from '../common/attributes/usePositionAttributes';
import { useCatch } from '../reactHelper';
import MapView from '../map/core/MapView';
import MapRoutePath from '../map/MapRoutePath';
import MapRoutePoints from '../map/MapRoutePoints';
import MapPositions from '../map/MapPositions';
import useReportStyles from './common/useReportStyles';
import TableShimmer from '../common/components/TableShimmer';
import MapCamera from '../map/MapCamera';
import MapGeofence from '../map/MapGeofence';
import scheduleReport from './common/scheduleReport';
import MapScale from '../map/MapScale';
import fetchOrThrow from '../common/util/fetchOrThrow';
import SelectField from '../common/components/SelectField';
import ReportMapSplit from './components/ReportMapSplit';
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
  const [items, setItems] = useState([]);
  const geofenceId = searchParams.has('geofenceId')
    ? parseInt(searchParams.get('geofenceId'))
    : null;
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const selectedRef = useRef();

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [selectedItem]);

  const onMapPointClick = useCallback(
    (positionId) => {
      setSelectedItem(items.find((it) => it.id === positionId));
    },
    [items, setSelectedItem],
  );

  const onShow = useCatch(async ({ deviceIds, from, to }) => {
    const query = new URLSearchParams({ from, to });
    if (geofenceId) {
      query.append('geofenceId', geofenceId);
    }
    deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
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
    } finally {
      setLoading(false);
    }
  });

  const formatExportValue = (position, key) => {
    const value = position.hasOwnProperty(key) ? position[key] : position.attributes?.[key];
    if (key === 'address') {
      return formatAddress(position, coordinateFormat);
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

  const mapPanel = selectedItem ? (
    <div className={classes.containerMap}>
      <MapView>
        <MapGeofence />
        {[...new Set(items.map((it) => it.deviceId))].map((deviceId) => {
          const positions = items.filter((position) => position.deviceId === deviceId);
          return (
            <Fragment key={deviceId}>
              <MapRoutePath positions={positions} />
              <MapRoutePoints positions={positions} onClick={onMapPointClick} />
            </Fragment>
          );
        })}
        <MapPositions positions={[selectedItem]} titleField="fixTime" />
      </MapView>
      <MapScale />
      <MapCamera positions={items} />
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
        </ReportFilter>
      </div>
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
            items.slice(0, 4000).map((item) => (
              <TableRow key={item.id}>
                <TableCell className={classes.columnAction} padding="none">
                  {selectedItem === item ? (
                    <IconButton
                      size="small"
                      onClick={() => setSelectedItem(null)}
                      ref={selectedRef}
                    >
                      <GpsFixedIcon fontSize="small" />
                    </IconButton>
                  ) : (
                    <IconButton size="small" onClick={() => setSelectedItem(item)}>
                      <LocationSearchingIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
                {columns.map((key) => (
                  <TableCell key={key}>
                    <PositionValue
                      position={item}
                      property={item.hasOwnProperty(key) ? key : null}
                      attribute={item.hasOwnProperty(key) ? null : key}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableShimmer columns={columns.length + 1} startAction />
          )}
        </TableBody>
      </Table>
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

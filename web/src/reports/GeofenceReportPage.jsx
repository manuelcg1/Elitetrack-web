import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import { formatDistance, formatNumericHours, formatTime } from '../common/util/formatter';
import ReportFilter, { updateReportParams } from './components/ReportFilter';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import ColumnSelect from './components/ColumnSelect';
import usePersistedState from '../common/util/usePersistedState';
import { useAttributePreference } from '../common/util/preferences';
import { useCatch, useEffectAsync } from '../reactHelper';
import useReportStyles from './common/useReportStyles';
import useGeofenceNames from './common/useGeofenceNames';
import TableShimmer from '../common/components/TableShimmer';
import fetchOrThrow from '../common/util/fetchOrThrow';
import SelectField from '../common/components/SelectField';
import exportExcel from '../common/util/exportExcel';
import { deviceEquality } from '../common/util/deviceEquality';
import MapView from '../map/core/MapView';
import MapGeofence from '../map/MapGeofence';
import MapRoutePath from '../map/MapRoutePath';
import MapCamera from '../map/MapCamera';
import MapScale from '../map/MapScale';
import ReportMapSplit from './components/ReportMapSplit';
import fallback from '../resources/l10n/en.json';

const columnsArray = [
  ['geofenceId', 'sharedGeofence'],
  ['startTime', 'reportGeofenceEnterTime'],
  ['endTime', 'reportGeofenceExitTime'],
  ['duration', 'reportDuration'],
  ['distance', 'reportGeofenceDistance'],
  ['state', 'reportGeofenceState'],
];
const columnsMap = new Map(columnsArray);

const itemKey = (item) => `${item.deviceId}_${item.geofenceId}_${item.startTime}`;
const itemDuration = (item) => Date.parse(item.endTime) - Date.parse(item.startTime);

const GeofenceReportPage = () => {
  const { classes } = useReportStyles();
  const translate = useTranslation();
  const t = (key) => translate(key) || fallback[key];
  const theme = useTheme();
  const distanceUnit = useAttributePreference('distanceUnit');

  const [searchParams, setSearchParams] = useSearchParams();
  const geofenceIds = useMemo(() => searchParams.getAll('geofenceId').map(Number), [searchParams]);

  const devices = useSelector((state) => state.devices.items, deviceEquality(['id', 'name']));
  const geofenceNames = useGeofenceNames();

  const [columns, setColumns] = usePersistedState('geofenceVisitColumns', [
    'geofenceId',
    'startTime',
    'endTime',
    'duration',
    'state',
  ]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [route, setRoute] = useState(null);

  const geofenceName = (item) =>
    item.geofenceName || geofenceNames[item.geofenceId] || `#${item.geofenceId}`;

  // Resumen por geocerca: cantidad de visitas y tiempo total dentro.
  const summary = useMemo(() => {
    const result = new Map();
    items.forEach((item) => {
      const entry = result.get(item.geofenceId) || { item, count: 0, duration: 0 };
      entry.count += 1;
      entry.duration += itemDuration(item);
      result.set(item.geofenceId, entry);
    });
    return [...result.values()];
  }, [items]);

  useEffectAsync(async () => {
    setRoute(null);
    if (selectedItem) {
      const query = new URLSearchParams({
        deviceId: selectedItem.deviceId,
        from: selectedItem.startTime,
        to: selectedItem.endTime,
      });
      const response = await fetchOrThrow(`/api/reports/route?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      setRoute(await response.json());
    }
  }, [selectedItem]);

  const onShow = useCatch(async ({ deviceIds, groupIds, from, to }) => {
    const query = new URLSearchParams({ from, to });
    deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
    groupIds.forEach((groupId) => query.append('groupId', groupId));
    geofenceIds.forEach((geofenceId) => query.append('geofenceId', geofenceId));
    setSelectedItem(null);
    setLoading(true);
    try {
      const response = await fetchOrThrow(`/api/reports/geofences?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      setItems(await response.json());
    } finally {
      setLoading(false);
    }
  });

  const stateText = (item) => {
    if (item.openStart) {
      return t('reportGeofenceOpenStart');
    }
    return t(item.openEnd ? 'reportGeofenceOpenEnd' : 'reportGeofenceComplete');
  };

  const formatText = (item, key) => {
    switch (key) {
      case 'geofenceId':
        return geofenceName(item);
      case 'startTime':
        return item.openStart ? t('reportGeofenceBefore') : formatTime(item.startTime, 'seconds');
      case 'endTime':
        return item.openEnd ? t('reportGeofenceInside') : formatTime(item.endTime, 'seconds');
      case 'duration':
        return `${item.openStart || item.openEnd ? '≥ ' : ''}${formatNumericHours(itemDuration(item), t)}`;
      case 'distance':
        return formatDistance(item.distance, distanceUnit, t);
      case 'state':
        return stateText(item);
      default:
        return item[key];
    }
  };

  const formatValue = (item, key) => {
    if ((key === 'startTime' && item.openStart) || (key === 'endTime' && item.openEnd)) {
      return (
        <Chip
          size="small"
          color={key === 'startTime' ? 'info' : 'warning'}
          label={formatText(item, key)}
        />
      );
    }
    if (key === 'state') {
      let color = 'success';
      if (item.openStart) {
        color = 'info';
      } else if (item.openEnd) {
        color = 'warning';
      }
      return <Chip size="small" variant="outlined" color={color} label={stateText(item)} />;
    }
    return formatText(item, key);
  };

  const onExport = useCatch(async () => {
    const sheets = new Map();
    items.forEach((item) => {
      const deviceName = devices[item.deviceId]?.name || item.deviceName || String(item.deviceId);
      if (!sheets.has(deviceName)) {
        sheets.set(deviceName, []);
      }
      const row = {};
      columns.forEach((key) => {
        row[t(columnsMap.get(key))] = formatText(item, key);
      });
      sheets.get(deviceName).push(row);
    });
    await exportExcel(t('sharedGeofences'), 'geofences.xlsx', sheets, theme);
  });

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'sharedGeofences']}>
      <div className={classes.container}>
        <ReportMapSplit
          storageKey="reportGeofencesSplitHeight"
          mapPanel={
            items.length ? (
              <div className={classes.containerMap}>
                <MapView>
                  <MapGeofence />
                  {route && route.length > 0 && (
                    <>
                      <MapRoutePath positions={route} />
                      <MapCamera positions={route} />
                    </>
                  )}
                </MapView>
                <MapScale />
              </div>
            ) : null
          }
          contentPanel={
            <div className={classes.containerMain}>
              <div className={classes.header}>
                <ReportFilter
                  onShow={onShow}
                  onExport={onExport}
                  deviceType="multiple"
                  loading={loading}
                >
                  <div className={classes.filterGeofence}>
                    <SelectField
                      label={t('sharedGeofences')}
                      value={geofenceIds}
                      onChange={(e) =>
                        updateReportParams(
                          searchParams,
                          setSearchParams,
                          'geofenceId',
                          e.target.value,
                        )
                      }
                      endpoint="/api/geofences"
                      multiple
                      singleLine
                      fullWidth
                    />
                  </div>
                  <ColumnSelect
                    columns={columns}
                    setColumns={setColumns}
                    columnsArray={columnsArray}
                  />
                </ReportFilter>
              </div>
              {!loading && summary.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, px: 2, pb: 2 }}>
                  {summary.map(({ item, count, duration }) => (
                    <Paper
                      key={item.geofenceId}
                      variant="outlined"
                      sx={{ flex: '1 1 180px', px: 1.5, py: 1, borderRadius: 3 }}
                    >
                      <Typography variant="subtitle2" noWrap>
                        {geofenceName(item)}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {`${t('reportGeofenceVisits')}: ${count} · ${formatNumericHours(duration, t)}`}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              )}
              <Table className={classes.compactTable}>
                <TableHead>
                  <TableRow>
                    <TableCell className={classes.columnAction} />
                    <TableCell>{t('sharedDevice')}</TableCell>
                    {columns.map((key) => (
                      <TableCell key={key}>{t(columnsMap.get(key))}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!loading ? (
                    items.map((item) => (
                      <TableRow
                        key={itemKey(item)}
                        hover
                        selected={selectedItem === item}
                        onClick={() => setSelectedItem(selectedItem === item ? null : item)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell className={classes.columnAction} padding="none">
                          <IconButton
                            size="small"
                            aria-label={t('reportGeofenceShowRoute')}
                            aria-pressed={selectedItem === item}
                          >
                            {selectedItem === item ? (
                              <GpsFixedIcon fontSize="small" />
                            ) : (
                              <LocationSearchingIcon fontSize="small" />
                            )}
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          {devices[item.deviceId]?.name || item.deviceName || item.deviceId}
                        </TableCell>
                        {columns.map((key) => (
                          <TableCell key={key}>{formatValue(item, key)}</TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableShimmer columns={columns.length + 2} startAction />
                  )}
                </TableBody>
              </Table>
            </div>
          }
        />
      </div>
    </PageLayout>
  );
};

export default GeofenceReportPage;

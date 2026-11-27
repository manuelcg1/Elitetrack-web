import { memo, useLayoutEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Drawer,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Popover,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import RouteIcon from '@mui/icons-material/Route';
import { useTranslation } from '../../common/components/LocalizationProvider';
import fallback from '../../resources/l10n/en.json';

const ROOT = 0;
const MIN_POPOVER_HEIGHT = 360;

const useStyles = makeStyles()((theme) => ({
  paper: {
    display: 'flex',
    flexDirection: 'column',
    width: 360,
    maxWidth: 'calc(100vw - 32px)',
    height: 'min(600px, calc(100vh - 96px))',
    borderRadius: 12,
    overflow: 'hidden',
    [theme.breakpoints.down('lg')]: {
      width: 340,
    },
  },
  sheet: {
    display: 'flex',
    flexDirection: 'column',
    height: '82dvh',
    width: '100%',
    maxWidth: 600,
    margin: '0 auto',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  handle: {
    flexShrink: 0,
    width: 40,
    height: 4,
    borderRadius: 2,
    margin: theme.spacing(1, 'auto', 0),
    backgroundColor: theme.palette.divider,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.25, 1, 0.75, 2),
  },
  controls: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(0, 1.5, 1),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  modeButton: {
    flexDirection: 'column',
    gap: 0,
    lineHeight: 1.25,
    padding: theme.spacing(0.5, 0.75),
    textTransform: 'none',
  },
  options: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  tree: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: theme.spacing(0.5, 0, 1),
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.25),
    minHeight: 40,
    paddingRight: theme.spacing(0.5),
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '&:hover .geofence-zoom, & .geofence-zoom:focus-visible': {
      opacity: 1,
    },
    [theme.breakpoints.down('sm')]: {
      minHeight: 46,
    },
  },
  name: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    cursor: 'pointer',
    userSelect: 'none',
  },
  swatch: {
    flexShrink: 0,
    width: 12,
    height: 12,
    borderRadius: 3,
    border: '1px solid rgba(0, 0, 0, 0.2)',
  },
  expand: {
    transition: theme.transitions.create('transform', { duration: 150 }),
  },
  expanded: {
    transform: 'rotate(90deg)',
  },
  spacer: {
    flexShrink: 0,
    width: 34,
  },
  zoom: {
    opacity: 0,
    '@media (hover: none)': {
      opacity: 1,
    },
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0.75, 1.5),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  section: {
    padding: theme.spacing(1, 2, 0.25),
    color: theme.palette.text.secondary,
    lineHeight: 2,
  },
  empty: {
    padding: theme.spacing(4, 2),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
}));

const normalize = (value) => (value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Carpetas y geocercas en árbol; cada carpeta conoce todas las geocercas que contiene.
const buildTree = (folders, geofences) => {
  const folderIds = new Set(folders.map((folder) => folder.id));
  const children = new Map();
  const items = new Map();
  folders.forEach((folder) => {
    const parent = folderIds.has(folder.parentid) ? folder.parentid : ROOT;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(folder);
  });
  geofences.forEach((geofence) => {
    const parent = folderIds.has(geofence.folderId) ? geofence.folderId : ROOT;
    if (!items.has(parent)) items.set(parent, []);
    items.get(parent).push(geofence);
  });
  const all = new Map();
  const collect = (id, seen = new Set()) => {
    if (all.has(id)) return all.get(id);
    if (seen.has(id)) return [];
    seen.add(id);
    const result = [...(items.get(id) || [])];
    (children.get(id) || []).forEach((folder) => result.push(...collect(folder.id, seen)));
    all.set(id, result);
    return result;
  };
  folders.forEach((folder) => collect(folder.id));
  return { children, items, all };
};

const GeofenceVisibilityPanel = ({
  open,
  anchorEl,
  onClose,
  loaded,
  folders,
  geofences,
  routeIds,
  mode,
  onMode,
  visibleIds,
  onChosen,
  labels,
  onLabels,
  onZoom,
  onFitRoute,
}) => {
  const { classes, cx } = useStyles();
  const theme = useTheme();
  // Teléfonos y tablets verticales: hoja inferior. Escritorio: panel junto al botón del mapa.
  const sheet = useMediaQuery(theme.breakpoints.down('md'));
  const [room, setRoom] = useState(null);

  // Alto disponible bajo el botón, para que el panel nunca salga de la pantalla.
  useLayoutEffect(() => {
    if (sheet || !open || !anchorEl) {
      return undefined;
    }
    const measure = () => {
      const top = anchorEl.getBoundingClientRect().top;
      setRoom(Math.max(MIN_POPOVER_HEIGHT, Math.floor(window.innerHeight - top - 16)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [sheet, open, anchorEl]);
  const translate = useTranslation();
  const t = (key) => translate(key) || fallback[key];

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());

  const tree = useMemo(() => buildTree(folders, geofences), [folders, geofences]);
  const query = normalize(search.trim());

  const color = (geofence) => geofence.attributes?.color || theme.palette.geometry.main;

  // Marcar una casilla pasa a "Elegidas", partiendo de lo que ya se veía.
  const setChecked = (ids, checked) => {
    const next = new Set(visibleIds);
    ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
    onChosen([...next]);
  };

  const toggleFolder = (id) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const geofenceRow = (geofence, level) => (
    <div key={`g${geofence.id}`} className={classes.row} style={{ paddingLeft: 8 + level * 20 }}>
      <span className={classes.spacer} />
      <Checkbox
        size="small"
        checked={visibleIds.has(geofence.id)}
        onChange={(event) => setChecked([geofence.id], event.target.checked)}
        slotProps={{ input: { 'aria-label': geofence.name } }}
      />
      <Box
        component="span"
        className={classes.name}
        onClick={() => setChecked([geofence.id], !visibleIds.has(geofence.id))}
      >
        <span className={classes.swatch} style={{ backgroundColor: color(geofence) }} />
        <Typography variant="body2" noWrap title={geofence.name}>
          {geofence.name}
        </Typography>
        {routeIds.has(geofence.id) && (
          <Chip
            size="small"
            color="success"
            variant="outlined"
            label={t('reportGeofencesOnRoute')}
            sx={{ height: 20, fontSize: '0.6875rem', flexShrink: 0 }}
          />
        )}
      </Box>
      <Tooltip title={t('reportGeofencesCenter')}>
        <IconButton
          size="small"
          className={cx(classes.zoom, 'geofence-zoom')}
          aria-label={`${t('reportGeofencesCenter')}: ${geofence.name}`}
          onClick={() => {
            if (!visibleIds.has(geofence.id)) {
              setChecked([geofence.id], true);
            }
            onZoom(geofence);
            if (sheet) onClose();
          }}
        >
          <CenterFocusStrongIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </div>
  );

  // Una carpeta se muestra en la búsqueda si coincide ella, una subcarpeta o una geocerca suya.
  const hasMatch = (id) =>
    (tree.items.get(id) || []).some((geofence) => normalize(geofence.name).includes(query)) ||
    (tree.children.get(id) || []).some(
      (folder) => normalize(folder.name).includes(query) || hasMatch(folder.id),
    );

  // includeAll: la carpeta coincide con la búsqueda, así que se muestra todo su contenido.
  const renderLevel = (parent, level, includeAll = false) => {
    const rows = [];
    (tree.children.get(parent) || []).forEach((folder) => {
      const all = tree.all.get(folder.id) || [];
      const folderMatch = includeAll || (query && normalize(folder.name).includes(query));
      if (query && !folderMatch && !hasMatch(folder.id)) return;
      const shown = all.filter((geofence) => visibleIds.has(geofence.id)).length;
      const isOpen = Boolean(query) || expanded.has(folder.id);
      rows.push(
        <div key={`f${folder.id}`} className={classes.row} style={{ paddingLeft: 8 + level * 20 }}>
          <IconButton
            size="small"
            aria-expanded={isOpen}
            aria-label={`${t(isOpen ? 'reportGeofencesCollapse' : 'reportGeofencesExpand')}: ${folder.name}`}
            onClick={() => toggleFolder(folder.id)}
            disabled={Boolean(query)}
          >
            <ChevronRightIcon
              fontSize="small"
              className={cx(classes.expand, isOpen && classes.expanded)}
            />
          </IconButton>
          <Checkbox
            size="small"
            checked={all.length > 0 && shown === all.length}
            indeterminate={shown > 0 && shown < all.length}
            disabled={!all.length}
            onChange={(event) =>
              setChecked(
                all.map((g) => g.id),
                event.target.checked,
              )
            }
            slotProps={{ input: { 'aria-label': folder.name } }}
          />
          <Box component="span" className={classes.name} onClick={() => toggleFolder(folder.id)}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }} title={folder.name}>
              {folder.name}
            </Typography>
            <Typography variant="caption" color="textSecondary" sx={{ flexShrink: 0 }}>
              {`${shown}/${all.length}`}
            </Typography>
          </Box>
        </div>,
      );
      if (isOpen) {
        rows.push(...renderLevel(folder.id, level + 1, Boolean(query && folderMatch)));
      }
    });
    const loose = (tree.items.get(parent) || []).filter(
      (geofence) => !query || includeAll || normalize(geofence.name).includes(query),
    );
    // Las geocercas sin carpeta llevan su propio título para no parecer de la carpeta anterior.
    if (parent === ROOT && loose.length && rows.length) {
      rows.push(
        <Typography key="loose" variant="overline" component="div" className={classes.section}>
          {`${t('reportGeofencesNoFolder')} · ${loose.length}`}
        </Typography>,
      );
    }
    loose.forEach((geofence) => rows.push(geofenceRow(geofence, level)));
    return rows;
  };

  const rows = loaded ? renderLevel(ROOT, 0) : [];
  const countLabel = (key, value) => t(key).replace('{0}', value);

  const content = (
    <>
      {sheet && <span className={classes.handle} />}
      <div className={classes.header}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {t('reportGeofencesPanel')}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {t('reportGeofencesVisible')
              .replace('{0}', visibleIds.size)
              .replace('{1}', geofences.length)}
          </Typography>
        </Box>
        <IconButton aria-label={t('sharedHide')} onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </div>
      <div className={classes.controls}>
        <TextField
          size="small"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('reportGeofencesSearch')}
          slotProps={{
            htmlInput: { 'aria-label': t('reportGeofencesSearch') },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          color="primary"
          value={mode}
          onChange={(_, value) => value && onMode(value)}
          aria-label={t('reportGeofencesPanel')}
        >
          <ToggleButton value="route" className={classes.modeButton}>
            <span>{t('reportGeofencesRoute')}</span>
            <Typography variant="caption" color="textSecondary">
              {countLabel('reportGeofencesCount', routeIds.size)}
            </Typography>
          </ToggleButton>
          <ToggleButton value="custom" className={classes.modeButton}>
            <span>{t('reportGeofencesChosen')}</span>
            <Typography variant="caption" color="textSecondary">
              {mode === 'custom' ? countLabel('reportGeofencesCount', visibleIds.size) : '—'}
            </Typography>
          </ToggleButton>
          <ToggleButton value="none" className={classes.modeButton}>
            <span>{t('reportGeofencesNone')}</span>
            <Typography variant="caption" color="textSecondary">
              {t('reportGeofencesHide')}
            </Typography>
          </ToggleButton>
        </ToggleButtonGroup>
        <div className={classes.options}>
          <FormControlLabel
            control={
              <Switch size="small" checked={labels} onChange={(_, value) => onLabels(value)} />
            }
            label={<Typography variant="body2">{t('reportGeofencesLabels')}</Typography>}
            sx={{ ml: 0, gap: 0.5 }}
          />
          <Box>
            <Button size="small" onClick={() => onChosen(geofences.map((g) => g.id))}>
              {t('reportGeofencesAll')}
            </Button>
            <Button size="small" color="inherit" onClick={() => onChosen([])}>
              {t('reportGeofencesClear')}
            </Button>
          </Box>
        </div>
      </div>
      <div className={classes.tree} role="tree" aria-label={t('reportGeofencesPanel')}>
        {!loaded && (
          <div className={classes.empty}>
            <CircularProgress size={24} />
          </div>
        )}
        {loaded && !rows.length && (
          <Typography variant="body2" className={classes.empty}>
            {t(query ? 'reportGeofencesEmpty' : 'reportGeofencesNoData')}
          </Typography>
        )}
        {rows}
      </div>
      <div className={classes.footer}>
        <Tooltip title={t('reportGeofencesSaved')}>
          <Button size="small" startIcon={<RouteIcon />} onClick={onFitRoute}>
            {t('reportGeofencesFitRoute')}
          </Button>
        </Tooltip>
      </div>
    </>
  );

  if (sheet) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        slotProps={{ paper: { className: classes.sheet } }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Popover
      open={open && Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: {
          className: classes.paper,
          sx: { ml: -1, ...(room !== null && { height: `min(600px, ${room}px)` }) },
        },
      }}
    >
      {content}
    </Popover>
  );
};

export default memo(GeofenceVisibilityPanel);

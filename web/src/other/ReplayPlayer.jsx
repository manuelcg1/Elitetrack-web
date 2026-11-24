import { memo, useId, useMemo } from 'react';
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ReplayIcon from '@mui/icons-material/Replay';
import FastForwardIcon from '@mui/icons-material/FastForward';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import { useSelector } from 'react-redux';
import { useTranslation } from '../common/components/LocalizationProvider';
import RouteColorSelect from '../reports/components/RouteColorSelect';
import {
  formatAddress,
  formatDistance,
  formatNumericHours,
  formatSpeed,
  formatTime,
} from '../common/util/formatter';
import { useAttributePreference, usePreference } from '../common/util/preferences';
import { accumulateDistance, buildSpeedChart } from '../common/util/routeReplay';
import fallback from '../resources/l10n/en.json';

export const replayRates = [0.5, 1, 2, 4, 8, 16];

const CHART_HEIGHT = 44;

const useStyles = makeStyles()((theme) => ({
  chart: {
    display: 'block',
    flexShrink: 0,
    width: '100%',
    height: CHART_HEIGHT,
  },
  meta: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    color: theme.palette.text.secondary,
    fontVariantNumeric: 'tabular-nums',
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  play: {
    margin: theme.spacing(0, 0.75),
    width: 48,
    height: 48,
    borderRadius: '50%',
    color: theme.palette.primary.contrastText,
    backgroundColor: theme.palette.primary.main,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  options: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.5fr',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(2),
  },
  switches: {
    display: 'flex',
    flexWrap: 'wrap',
    marginTop: theme.spacing(0.5),
  },
  data: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: theme.spacing(1),
    marginTop: theme.spacing(0.5),
    paddingTop: theme.spacing(1.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    fontVariantNumeric: 'tabular-nums',
  },
  address: {
    gridColumn: '1 / -1',
  },
}));

const SpeedChart = memo(({ positions, color }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const items = useMemo(() => buildSpeedChart(positions), [positions]);

  const path = useMemo(() => {
    const points = items.map(
      ({ value }, index) =>
        `L${index + 0.5} ${(CHART_HEIGHT - value * (CHART_HEIGHT - 4)).toFixed(1)}`,
    );
    return `M0 ${CHART_HEIGHT}${points.join('')}L${items.length} ${CHART_HEIGHT}Z`;
  }, [items]);

  return (
    <svg
      className={classes.chart}
      viewBox={`0 0 ${items.length} ${CHART_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {items.map(
        ({ stopped }, index) =>
          stopped && (
            <rect
              key={index}
              x={index}
              width={1}
              height={CHART_HEIGHT}
              fill={theme.palette.error.main}
              opacity={0.2}
              shapeRendering="crispEdges"
            />
          ),
      )}
      <path d={path} fill={color || theme.palette.primary.main} opacity={0.45} />
    </svg>
  );
});

SpeedChart.displayName = 'SpeedChart';

const ReplayPlayer = ({
  positions,
  index,
  onIndex,
  playing,
  onToggle,
  rate,
  onRate,
  follow,
  onFollow,
  skipStops,
  onSkipStops,
  color,
  onColor,
}) => {
  const { classes } = useStyles();
  const translate = useTranslation();
  const t = (key) => translate(key) || fallback[key];
  const rateId = useId();

  const speedUnit = useAttributePreference('speedUnit');
  const distanceUnit = useAttributePreference('distanceUnit');
  const coordinateFormat = usePreference('coordinateFormat');

  const position = positions[index];
  const device = useSelector((state) => state.devices.items[position.deviceId]);
  const distances = useMemo(() => accumulateDistance(positions), [positions]);

  const last = positions.length - 1;
  const ended = index >= last;
  const elapsed = Date.parse(position.fixTime) - Date.parse(positions[0].fixTime);

  const playTitle = () => {
    if (playing) {
      return t('replayPause');
    }
    return t(ended ? 'replayRestart' : 'replayPlay');
  };

  const playIcon = () => {
    if (playing) {
      return <PauseIcon />;
    }
    return ended ? <ReplayIcon /> : <PlayArrowIcon />;
  };

  const stepButton = (key, icon, target, disabled) => (
    <Tooltip title={t(key)}>
      <span>
        <IconButton aria-label={t(key)} disabled={disabled} onClick={() => onIndex(target)}>
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );

  const dataItem = (label, value) => (
    <div>
      <Typography variant="body1" noWrap title={value} sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="textSecondary" component="div" noWrap>
        {label}
      </Typography>
    </div>
  );

  const address = formatAddress(position, coordinateFormat);

  return (
    <>
      <Typography variant="subtitle1" align="center" noWrap>
        {device?.name}
      </Typography>
      <SpeedChart positions={positions} color={color} />
      <Slider
        aria-label={t('reportReplay')}
        size="small"
        max={Math.max(last, 1)}
        value={index}
        onChange={(_, value) => onIndex(value)}
      />
      <Typography variant="body2" component="div" className={classes.meta}>
        <span>{`${index + 1}/${positions.length}`}</span>
        <span>{formatTime(position.fixTime, 'seconds')}</span>
      </Typography>
      <div className={classes.controls}>
        {stepButton('replayFirst', <SkipPreviousIcon />, 0, index <= 0)}
        {stepButton('replayPrevious', <FastRewindIcon />, index - 1, index <= 0)}
        <Tooltip title={playTitle()}>
          <IconButton className={classes.play} aria-label={playTitle()} onClick={onToggle}>
            {playIcon()}
          </IconButton>
        </Tooltip>
        {stepButton('replayNext', <FastForwardIcon />, index + 1, ended)}
        {stepButton('replayLast', <SkipNextIcon />, last, ended)}
      </div>
      <div className={classes.options}>
        <FormControl fullWidth size="small">
          <InputLabel id={rateId}>{t('replaySpeed')}</InputLabel>
          <Select
            size="small"
            labelId={rateId}
            label={t('replaySpeed')}
            value={rate}
            onChange={(event) => onRate(event.target.value)}
          >
            {replayRates.map((value) => (
              <MenuItem key={value} value={value}>{`${value}×`}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <RouteColorSelect
          value={color}
          onChange={onColor}
          deviceColor={device?.attributes?.['web.reportColor']}
        />
      </div>
      <div className={classes.switches}>
        <FormControlLabel
          control={<Checkbox checked={follow} onChange={(_, checked) => onFollow(checked)} />}
          label={t('replayFollow')}
        />
        <FormControlLabel
          control={<Checkbox checked={skipStops} onChange={(_, checked) => onSkipStops(checked)} />}
          label={t('replaySkipStops')}
        />
      </div>
      <div className={classes.data}>
        {dataItem(t('positionSpeed'), formatSpeed(position.speed, speedUnit, t))}
        {dataItem(t('sharedDistance'), formatDistance(distances[index], distanceUnit, t))}
        {dataItem(t('replayElapsed'), formatNumericHours(elapsed, t))}
        <Typography variant="body2" noWrap title={address} className={classes.address}>
          {address}
        </Typography>
      </div>
    </>
  );
};

export default ReplayPlayer;

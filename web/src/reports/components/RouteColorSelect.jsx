import { useId, useRef, useState } from 'react';
import {
  Box,
  ButtonBase,
  Drawer,
  FormControl,
  InputLabel,
  MenuItem,
  Popover,
  Select,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { interpolateTurbo } from '../../common/util/colors';
import useReportStyles from '../common/useReportStyles';
import fallback from '../../resources/l10n/en.json';

const palette = [
  ['colorGreen', '#00C853'],
  ['colorBlue', '#2196F3'],
  ['colorNavy', '#1A3FB0'],
  ['colorPurple', '#7C4DFF'],
  ['colorMagenta', '#D500F9'],
  ['colorRed', '#E53935'],
  ['colorOrange', '#FF6D00'],
  ['colorYellow', '#FFB800'],
  ['colorBrown', '#795548'],
  ['colorBlack', '#0F172A'],
];

const speedGradient = `linear-gradient(90deg, ${[0, 0.2, 0.4, 0.6, 0.8, 1]
  .map((value) => `rgb(${interpolateTurbo(value).join(', ')})`)
  .join(', ')})`;

export const isRouteColor = (value) => /^#[0-9a-f]{6}$/i.test(value);

const useStyles = makeStyles()((theme) => ({
  value: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
  },
  swatch: {
    flexShrink: 0,
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: '1px solid rgba(100, 116, 139, 0.55)',
  },
  panel: {
    width: 300,
    padding: theme.spacing(1.5),
    [theme.breakpoints.down('sm')]: {
      width: 'auto',
      paddingBottom: theme.spacing(3),
    },
  },
  automatic: {
    width: '100%',
    justifyContent: 'flex-start',
    textAlign: 'start',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1, 1.25),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 10,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '&[aria-pressed="true"]': {
      borderColor: theme.palette.primary.main,
      backgroundColor: theme.palette.action.selected,
    },
  },
  title: {
    display: 'block',
    margin: theme.spacing(1.75, 0, 0.75),
    color: theme.palette.text.secondary,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: theme.spacing(0.75),
  },
  option: {
    height: 46,
    borderRadius: 10,
    '&:hover, &:focus-visible': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  optionSwatch: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    '& svg': {
      filter: 'drop-shadow(0 0 1px #000000)',
    },
  },
  selectedSwatch: {
    boxShadow: `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 4px ${theme.palette.text.primary}`,
  },
  custom: {
    display: 'flex',
    gap: theme.spacing(1),
  },
  picker: {
    flexShrink: 0,
    width: 48,
    height: 48,
    padding: theme.spacing(0.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 10,
    background: 'none',
    cursor: 'pointer',
  },
}));

const RouteColorSelect = ({ value, onChange, deviceColor }) => {
  const { classes, cx } = useStyles();
  const { classes: reportClasses } = useReportStyles();
  const theme = useTheme();
  const translate = useTranslation();
  const t = (key) => translate(key) || fallback[key];
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const labelId = useId();

  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const selected = palette.find(([, color]) => color === value);
  const automaticBackground = deviceColor || speedGradient;
  const invalid = Boolean(text) && !isRouteColor(text);

  const onOpen = () => {
    setText(value || '');
    setOpen(true);
  };

  const onClose = () => setOpen(false);

  const onSelect = (color) => {
    onChange(color);
    onClose();
  };

  const onText = (input) => {
    const trimmed = input.trim().toUpperCase();
    const color = trimmed && !trimmed.startsWith('#') ? `#${trimmed}` : trimmed;
    setText(color);
    if (isRouteColor(color)) {
      onChange(color);
    }
  };

  const panel = (
    <div className={classes.panel}>
      <ButtonBase
        className={classes.automatic}
        aria-pressed={!value}
        onClick={() => onSelect(null)}
      >
        <span className={classes.swatch} style={{ background: automaticBackground }} />
        <span>
          <Typography variant="body1" component="span" sx={{ display: 'block' }}>
            {t('reportLineColorAutomatic')}
          </Typography>
          <Typography variant="caption" component="span" color="textSecondary">
            {t(deviceColor ? 'reportLineColorDevice' : 'reportLineColorSpeed')}
          </Typography>
        </span>
      </ButtonBase>
      <Typography variant="caption" className={classes.title}>
        {t('reportLineColorPalette')}
      </Typography>
      <div className={classes.grid}>
        {palette.map(([key, color]) => (
          <Tooltip key={color} title={t(key)}>
            <ButtonBase
              className={classes.option}
              aria-label={t(key)}
              aria-pressed={color === value}
              onClick={() => onSelect(color)}
            >
              <span
                className={cx(
                  classes.swatch,
                  classes.optionSwatch,
                  color === value && classes.selectedSwatch,
                )}
                style={{ background: color }}
              >
                {color === value && <CheckIcon fontSize="small" />}
              </span>
            </ButtonBase>
          </Tooltip>
        ))}
      </div>
      <Typography variant="caption" className={classes.title}>
        {t('reportLineColorCustom')}
      </Typography>
      <div className={classes.custom}>
        <input
          type="color"
          className={classes.picker}
          aria-label={t('reportLineColorCustom')}
          value={(value || (isRouteColor(deviceColor) && deviceColor) || '#00C853').toLowerCase()}
          onChange={(event) => onText(event.target.value)}
        />
        <TextField
          fullWidth
          value={text}
          placeholder="#RRGGBB"
          error={invalid}
          helperText={invalid ? t('reportLineColorInvalid') : ' '}
          onChange={(event) => onText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !invalid) {
              onClose();
            }
          }}
          slotProps={{
            htmlInput: { maxLength: 7, 'aria-label': t('reportLineColorCustom') },
          }}
        />
      </div>
    </div>
  );

  return (
    <div className={reportClasses.filterColor} ref={anchorRef}>
      <FormControl fullWidth size="small">
        <InputLabel id={labelId}>{t('reportLineColor')}</InputLabel>
        <Select
          size="small"
          labelId={labelId}
          label={t('reportLineColor')}
          value={value || 'automatic'}
          open={false}
          onOpen={onOpen}
          renderValue={() => (
            <Box component="span" className={classes.value}>
              <span
                className={classes.swatch}
                style={{ background: value || automaticBackground }}
              />
              <Typography component="span" variant="inherit" noWrap>
                {value ? (selected && t(selected[0])) || value : t('reportLineColorAutomatic')}
              </Typography>
            </Box>
          )}
        >
          <MenuItem value={value || 'automatic'} />
        </Select>
      </FormControl>
      {phone ? (
        <Drawer anchor="bottom" open={open} onClose={onClose}>
          {panel}
        </Drawer>
      ) : (
        <Popover
          open={open}
          onClose={onClose}
          anchorEl={() => anchorRef.current}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          {panel}
        </Popover>
      )}
    </div>
  );
};

export default RouteColorSelect;

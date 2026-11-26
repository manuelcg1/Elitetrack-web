import { Box, Chip } from '@mui/material';
import { useTranslation } from '../../common/components/LocalizationProvider';
import fallback from '../../resources/l10n/en.json';

const markStyle = {
  ml: 0.75,
  fontSize: '0.75rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

// Geocercas de una posición; marca dónde entra o sale respecto a la posición anterior del mismo equipo.
const GeofenceVisitCell = ({ current, previous, names }) => {
  const translate = useTranslation();
  const t = (key) => translate(key) || fallback[key];

  const ids = current || [];
  const entered = previous ? ids.filter((id) => !previous.includes(id)) : [];
  const left = previous ? previous.filter((id) => !ids.includes(id)) : [];
  const name = (id) => names[id] || `#${id}`;

  if (!ids.length && !left.length) {
    return null;
  }

  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}
    >
      {ids.map((id) => (
        <Chip key={id} size="small" variant="outlined" label={name(id)} />
      ))}
      {entered.length > 0 && (
        <Box component="span" sx={{ ...markStyle, color: 'success.main' }}>
          {`↘ ${t('reportGeofenceEnter')}`}
        </Box>
      )}
      {left.length > 0 && (
        <Box component="span" sx={{ ...markStyle, color: 'error.main' }}>
          {`↗ ${t('reportGeofenceExit')} ${left.map(name).join(', ')}`}
        </Box>
      )}
    </Box>
  );
};

export default GeofenceVisitCell;

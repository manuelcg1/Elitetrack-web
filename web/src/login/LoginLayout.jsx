import { useMediaQuery, Paper, Box, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';

// ── Tokens de marca EliteTrack ────────────────────────────────────────────────
const ET = {
  green: '#00E65B',
  greenDark: '#00B848',
  dark: '#212529',
  silver: '#4A5056',
};

// ── Feature item del panel izquierdo ─────────────────────────────────────────
const FeatureItem = ({ icon, label }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
    <Box
      sx={{
        width: 32,
        height: 32,
        borderRadius: '8px',
        background: 'rgba(0,230,91,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 17, color: ET.green }} aria-hidden="true" />
    </Box>
    <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', fontWeight: 400 }}>
      {label}
    </Typography>
  </Box>
);

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    height: '100%',
    backgroundColor: theme.palette.background.default,
  },

  // ── Panel izquierdo — branding EliteTrack ────────────────────────────────
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    backgroundColor: ET.dark,
    padding: theme.spacing(6),
    gap: theme.spacing(3),
    width: theme.dimensions.sidebarWidth,
    [theme.breakpoints.down('lg')]: {
      width: theme.dimensions.sidebarWidthTablet,
    },
    [theme.breakpoints.down('sm')]: {
      display: 'none',
    },
  },

  // ── Panel derecho — formulario ───────────────────────────────────────────
  paper: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    borderRadius: 0,
    boxShadow:
      theme.palette.mode === 'dark'
        ? '-2px 0px 24px rgba(0,0,0,0.5)'
        : '-2px 0px 24px rgba(0,0,0,0.08)',
    backgroundColor: theme.palette.background.paper,
  },

  form: {
    width: '100%',
    maxWidth: theme.spacing(52),
    padding: theme.spacing(5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0),
  },
}));

const LoginLayout = ({ children }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('lg'));

  return (
    <main className={classes.root}>
      {/* ── Panel izquierdo con identidad EliteTrack ── */}
      <div className={classes.sidebar}>
        {/* Badge */}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            border: '1px solid rgba(0,230,91,0.30)',
            borderRadius: '20px',
            padding: '4px 12px',
          }}
        >
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: ET.green,
              animation: 'pulse 2s infinite',
            }}
          />
          <Typography
            sx={{
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.07em',
              color: ET.green,
              textTransform: 'uppercase',
            }}
          >
            Sistema activo
          </Typography>
        </Box>

        {/* Título principal */}
        <Box>
          <Typography
            sx={{
              fontSize: '2.2rem',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: '#fff',
            }}
          >
            Rastreo{' '}
            <Box component="span" sx={{ color: ET.green }}>
              inteligente
            </Box>{' '}
            para tu flota
          </Typography>
          <Typography
            sx={{
              fontSize: '0.9rem',
              color: 'rgba(255,255,255,0.5)',
              mt: 1.5,
              lineHeight: 1.6,
              fontWeight: 400,
            }}
          >
            Monitorea tus vehículos en tiempo real con tecnología GPS de punta.
          </Typography>
        </Box>

        {/* Features */}
        {isLargeScreen && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <FeatureItem icon="ti-map-pin" label="Rastreo GPS en tiempo real" />
            <FeatureItem icon="ti-bell-rng" label="Alertas y notificaciones automáticas" />
            <FeatureItem icon="ti-chart-bar" label="Reportes y estadísticas detalladas" />
            <FeatureItem icon="ti-shield-check" label="Geocercas y zonas de seguridad" />
            <FeatureItem icon="ti-route" label="Historial de rutas y recorridos" />
          </Box>
        )}

        {/* Footer del panel */}
        <Box sx={{ mt: 'auto', pt: 2 }}>
          <Typography
            sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}
          >
            © {new Date().getFullYear()} EliteTrack. Todos los derechos reservados.
          </Typography>
        </Box>
      </div>

      {/* ── Panel derecho con el formulario ── */}
      <Paper className={classes.paper} elevation={0}>
        <form className={classes.form} noValidate>
          {children}
        </form>
      </Paper>

      {/* Animación del punto pulsante */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </main>
  );
};

export default LoginLayout;

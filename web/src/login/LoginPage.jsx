import { useEffect, useState } from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  Button,
  TextField,
  Link,
  Snackbar,
  IconButton,
  Tooltip,
  InputAdornment,
  Box,
  Typography,
  Divider,
} from '@mui/material';
import CountryFlag from 'react-country-flag';
import { makeStyles } from 'tss-react/mui';
import CloseIcon from '@mui/icons-material/Close';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { sessionActions } from '../store';
import { useLocalization, useTranslation } from '../common/components/LocalizationProvider';
import LoginLayout from './LoginLayout';
import usePersistedState from '../common/util/usePersistedState';
import {
  generateLoginToken,
  handleLoginTokenListeners,
  nativeEnvironment,
  nativePostMessage,
} from '../common/components/NativeInterface';
import { useCatch } from '../reactHelper';
import QrCodeDialog from '../common/components/QrCodeDialog';
import fetchOrThrow from '../common/util/fetchOrThrow';

// ── Tokens de marca ───────────────────────────────────────────────────────────
const ET = {
  green:     '#00E65B',
  greenDark: '#00B848',
  dark:      '#212529',
  silver:    '#4A5056',
};

const useStyles = makeStyles()((theme) => ({
  // Controles flotantes (idioma, QR, servidor)
  options: {
    position: 'fixed',
    top: theme.spacing(2),
    right: theme.spacing(2),
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(1),
    zIndex: 10,
  },

  // Logo + nombre de marca
  brandHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(3.5),
  },
  logoBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: '1.5rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1,
  },
  brandElite: { color: ET.green },
  brandTrack: { color: theme.palette.text.primary },
  brandTagline: {
    fontSize: '0.72rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
  },

  // Campos del formulario
  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },

  // Botón principal
  submitButton: {
    padding: '11px',
    fontSize: '0.95rem',
    fontWeight: 700,
    letterSpacing: '0.01em',
    background: `linear-gradient(135deg, ${ET.green} 0%, ${ET.greenDark} 100%)`,
    color: ET.dark,
    borderRadius: 10,
    marginTop: theme.spacing(1),
    '&:hover': {
      background: `linear-gradient(135deg, #1AFF70 0%, ${ET.green} 100%)`,
      boxShadow: `0 4px 20px rgba(0,230,91,0.35)`,
    },
    '&:disabled': {
      background: theme.palette.mode === 'dark'
        ? 'rgba(0,230,91,0.12)'
        : 'rgba(0,230,91,0.20)',
      color: theme.palette.mode === 'dark'
        ? 'rgba(255,255,255,0.25)'
        : 'rgba(33,37,41,0.35)',
    },
  },

  // Botón OpenID
  openIdButton: {
    padding: '11px',
    borderRadius: 10,
    borderWidth: '1.5px',
    fontWeight: 600,
    '&:hover': { borderWidth: '1.5px' },
  },

  // Links de registro / reset
  linksRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: theme.spacing(3),
    marginTop: theme.spacing(2),
  },
  link: {
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
    transition: 'color 0.15s',
    '&:hover': { color: ET.green },
  },
  dividerLabel: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    padding: theme.spacing(0, 1.5),
  },
  flag: { marginRight: theme.spacing(1) },
}));

const LoginPage = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useTranslation();

  const { languages, language, setLocalLanguage } = useLocalization();
  const languageList = Object.entries(languages).map(([code, val]) => ({
    code,
    country: val.country,
    name: val.name,
  }));

  const [failed, setFailed] = useState(false);
  const [email, setEmail] = usePersistedState('loginEmail', '');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showServerTooltip, setShowServerTooltip] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [codeEnabled, setCodeEnabled] = useState(false);
  const [announcementShown, setAnnouncementShown] = useState(false);

  const registrationEnabled = useSelector((state) => state.session.server.registration);
  const languageEnabled = useSelector((state) => {
    const { attributes } = state.session.server;
    return !attributes.language && !attributes['ui.disableLoginLanguage'];
  });
  const changeEnabled = useSelector((state) => !state.session.server.attributes.disableChange);
  const emailEnabled = useSelector((state) => state.session.server.emailEnabled);
  const openIdEnabled = useSelector((state) => state.session.server.openIdEnabled);
  const openIdForced = useSelector(
    (state) => state.session.server.openIdEnabled && state.session.server.openIdForce,
  );
  const announcement = useSelector((state) => state.session.server.announcement);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handlePasswordLogin = async (event) => {
    event.preventDefault();
    setFailed(false);
    try {
      const query = `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
      const body = code.length ? `${query}&code=${code}` : query;
      const response = await fetch('/api/session', {
        method: 'POST',
        body: new URLSearchParams(body),
      });
      if (response.ok) {
        const user = await response.json();
        generateLoginToken();
        dispatch(sessionActions.updateUser(user));
        const target = window.sessionStorage.getItem('postLogin') || '/';
        window.sessionStorage.removeItem('postLogin');
        navigate(target, { replace: true });
      } else if (response.status === 401 && response.headers.get('WWW-Authenticate') === 'TOTP') {
        setCodeEnabled(true);
      } else {
        throw Error(await response.text());
      }
    } catch {
      setFailed(true);
      setPassword('');
    }
  };

  const handleTokenLogin = useCatch(async (token) => {
    const response = await fetchOrThrow(`/api/session?token=${encodeURIComponent(token)}`);
    const user = await response.json();
    dispatch(sessionActions.updateUser(user));
    navigate('/');
  });

  const handleOpenIdLogin = () => {
    document.location = '/api/session/openid/auth';
  };

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => nativePostMessage('authentication'), []);

  useEffect(() => {
    const listener = (token) => handleTokenLogin(token);
    handleLoginTokenListeners.add(listener);
    return () => handleLoginTokenListeners.delete(listener);
  }, []);

  useEffect(() => {
    if (window.localStorage.getItem('hostname') !== window.location.hostname) {
      window.localStorage.setItem('hostname', window.location.hostname);
      setShowServerTooltip(true);
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <LoginLayout>

      {/* Controles flotantes: idioma, QR, servidor */}
      <div className={classes.options}>
        {nativeEnvironment && changeEnabled && (
          <IconButton color="primary" onClick={() => navigate('/change-server')}>
            <Tooltip
              title={`${t('settingsServer')}: ${window.location.hostname}`}
              open={showServerTooltip}
              arrow
            >
              <VpnLockIcon />
            </Tooltip>
          </IconButton>
        )}
        {!nativeEnvironment && (
          <IconButton color="primary" onClick={() => setShowQr(true)}>
            <QrCode2Icon />
          </IconButton>
        )}
        {languageEnabled && (
          <FormControl size="small">
            <Select value={language} onChange={(e) => setLocalLanguage(e.target.value)}>
              {languageList.map((it) => (
                <MenuItem key={it.code} value={it.code}>
                  <span className={classes.flag}>
                    <CountryFlag countryCode={it.country} svg />
                  </span>
                  {it.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </div>

      {/* Logo + nombre de marca */}
      <div className={classes.brandHeader}>
        <Box className={classes.logoBox}>
          <Box
            component="img"
            src="/logo.svg"
            alt="EliteTrack"
            sx={{ width: 80, height: 80, objectFit: 'contain' }}
          />
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography className={classes.brandName}>
            <span className={classes.brandElite}>ELITE</span>
            <span className={classes.brandTrack}>TRACK</span>
          </Typography>
          <Typography className={classes.brandTagline}>
            Sistema de rastreo GPS
          </Typography>
        </Box>
      </div>

      {/* Campos del formulario */}
      {!openIdForced && (
        <div className={classes.fields}>
          <TextField
            required
            error={failed}
            label={t('userEmail')}
            name="email"
            value={email}
            autoComplete="email"
            autoFocus={!email}
            onChange={(e) => setEmail(e.target.value)}
            helperText={failed && t('loginFailed')}
            fullWidth
          />
          <TextField
            required
            error={failed}
            label={t('userPassword')}
            name="password"
            value={password}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            autoFocus={!!email}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((prev) => !prev)}
                      edge="end"
                      size="small"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          {codeEnabled && (
            <TextField
              required
              error={failed}
              label={t('loginTotpCode')}
              name="code"
              value={code}
              type="number"
              onChange={(e) => setCode(e.target.value)}
              fullWidth
            />
          )}
          <Button
            onClick={handlePasswordLogin}
            type="submit"
            variant="contained"
            fullWidth
            className={classes.submitButton}
            disabled={!email || !password || (codeEnabled && !code)}
          >
            {t('loginLogin')}
          </Button>
        </div>
      )}

      {/* Separador OpenID */}
      {openIdEnabled && !openIdForced && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1 }}>
          <Divider sx={{ flex: 1 }} />
          <Typography className={classes.dividerLabel}>o</Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>
      )}

      {openIdEnabled && (
        <Button
          onClick={handleOpenIdLogin}
          variant="outlined"
          color="primary"
          fullWidth
          className={classes.openIdButton}
        >
          {t('loginOpenId')}
        </Button>
      )}

      {/* Links registro / reset */}
      {!openIdForced && (registrationEnabled || emailEnabled) && (
        <div className={classes.linksRow}>
          {registrationEnabled && (
            <Link
              onClick={() => navigate('/register')}
              className={classes.link}
              underline="none"
            >
              {t('loginRegister')}
            </Link>
          )}
          {emailEnabled && (
            <Link
              onClick={() => navigate('/reset-password')}
              className={classes.link}
              underline="none"
            >
              {t('loginReset')}
            </Link>
          )}
        </div>
      )}

      <QrCodeDialog open={showQr} onClose={() => setShowQr(false)} />

      <Snackbar
        open={!!announcement && !announcementShown}
        message={announcement}
        action={
          <IconButton
            size="small"
            color="inherit"
            onClick={() => setAnnouncementShown(true)}
            aria-label="Cerrar anuncio"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </LoginLayout>
  );
};

export default LoginPage;

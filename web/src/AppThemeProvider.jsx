import { createContext, useContext } from 'react';
import { useSelector } from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import usePersistedState from './common/util/usePersistedState';
import dimensions from './common/theme/dimensions';
import palette from './common/theme/palette';

// ── Tokens de marca EliteTrack ────────────────────────────────────────────────
const ET = {
  green: '#00C853',
  greenDark: '#00B248',
  greenLight: '#DCFCE7',
  greenGlow: (alpha) => `rgba(0,200,83,${alpha})`,
  dark: '#0F172A',
  darkSoft: '#172033',
  text: '#1E293B',
  silver: '#64748B',
  silverLight: '#94A3B8',
  background: '#F8FAFC',
  border: '#E2E8F0',
  white: '#FFFFFF',
};

// ── Contexto dark mode ────────────────────────────────────────────────────────
const ColorModeContext = createContext({
  darkMode: false,
  toggleDarkMode: () => {},
});

export const useColorMode = () => useContext(ColorModeContext);

// ── Helpers que devuelven el valor correcto según modo ────────────────────────
const lod = (darkMode, light, dark) => (darkMode ? dark : light);

const AppThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = usePersistedState('darkMode', false);
  const server = useSelector((state) => state.session.server);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  // Alias corto para el helper en este scope
  const m = (light, dark) => lod(darkMode, light, dark);

  const theme = createTheme({
    // ── Paleta (tu palette.js original con colores EliteTrack) ───────────────
    palette: palette(server, darkMode),
    dimensions,

    // ── Tipografía ────────────────────────────────────────────────────────────
    typography: {
      fontFamily: 'Inter, Roboto, "Segoe UI", Helvetica, Arial, sans-serif',
      fontWeightRegular: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700,
      h1: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.2 },
      h2: { fontSize: '1.625rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.25 },
      h3: { fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.3 },
      h4: { fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.35 },
      h5: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.35 },
      h6: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.35 },
      subtitle1: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.4 },
      subtitle2: { fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.45 },
      body1: { fontSize: '0.9375rem', fontWeight: 400, lineHeight: 1.6 },
      body2: { fontSize: '0.8125rem', fontWeight: 400, lineHeight: 1.5 },
      button: { fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.4, textTransform: 'none' },
      caption: { fontSize: '0.75rem', fontWeight: 400, lineHeight: 1.5 },
      overline: { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', lineHeight: 1.5 },
    },

    shape: { borderRadius: 12 },

    shadows: [
      'none',
      m(
        '0px 1px 2px rgba(0,0,0,0.06), 0px 1px 3px rgba(0,0,0,0.10)',
        '0px 1px 2px rgba(0,0,0,0.30), 0px 1px 3px rgba(0,0,0,0.25)',
      ),
      m(
        '0px 2px 6px rgba(0,0,0,0.06), 0px 4px 8px rgba(0,0,0,0.08)',
        '0px 2px 6px rgba(0,0,0,0.35), 0px 4px 8px rgba(0,0,0,0.30)',
      ),
      m(
        '0px 4px 12px rgba(0,0,0,0.07), 0px 6px 14px rgba(0,0,0,0.08)',
        '0px 4px 12px rgba(0,0,0,0.40), 0px 6px 14px rgba(0,0,0,0.35)',
      ),
      m('0px 6px 16px rgba(0,0,0,0.08)', '0px 6px 16px rgba(0,0,0,0.45)'),
      m('0px 8px 20px rgba(0,0,0,0.08)', '0px 8px 20px rgba(0,0,0,0.45)'),
      m('0px 10px 24px rgba(0,0,0,0.09)', '0px 10px 24px rgba(0,0,0,0.50)'),
      m('0px 12px 28px rgba(0,0,0,0.09)', '0px 12px 28px rgba(0,0,0,0.50)'),
      m('0px 14px 32px rgba(0,0,0,0.10)', '0px 14px 32px rgba(0,0,0,0.55)'),
      m('0px 16px 36px rgba(0,0,0,0.10)', '0px 16px 36px rgba(0,0,0,0.55)'),
      m('0px 18px 40px rgba(0,0,0,0.11)', '0px 18px 40px rgba(0,0,0,0.60)'),
      m('0px 20px 44px rgba(0,0,0,0.11)', '0px 20px 44px rgba(0,0,0,0.60)'),
      m('0px 22px 48px rgba(0,0,0,0.12)', '0px 22px 48px rgba(0,0,0,0.65)'),
      m('0px 24px 52px rgba(0,0,0,0.12)', '0px 24px 52px rgba(0,0,0,0.65)'),
      m('0px 26px 56px rgba(0,0,0,0.13)', '0px 26px 56px rgba(0,0,0,0.70)'),
      m('0px 28px 60px rgba(0,0,0,0.13)', '0px 28px 60px rgba(0,0,0,0.70)'),
      m('0px 30px 64px rgba(0,0,0,0.14)', '0px 30px 64px rgba(0,0,0,0.70)'),
      m('0px 32px 68px rgba(0,0,0,0.14)', '0px 32px 68px rgba(0,0,0,0.75)'),
      m('0px 34px 72px rgba(0,0,0,0.15)', '0px 34px 72px rgba(0,0,0,0.75)'),
      m('0px 36px 76px rgba(0,0,0,0.15)', '0px 36px 76px rgba(0,0,0,0.80)'),
      m('0px 38px 80px rgba(0,0,0,0.15)', '0px 38px 80px rgba(0,0,0,0.80)'),
      m('0px 40px 84px rgba(0,0,0,0.16)', '0px 40px 84px rgba(0,0,0,0.85)'),
      m('0px 42px 88px rgba(0,0,0,0.16)', '0px 42px 88px rgba(0,0,0,0.85)'),
      m('0px 44px 92px rgba(0,0,0,0.17)', '0px 44px 92px rgba(0,0,0,0.90)'),
      m('0px 46px 96px rgba(0,0,0,0.17)', '0px 46px 96px rgba(0,0,0,0.90)'),
    ],

    // ── Overrides de componentes — todos con condicional light/dark ───────────
    components: {
      // ── Global: fuente, scrollbar ─────────────────────────────────────────
      MuiCssBaseline: {
        styleOverrides: {
          '@import':
            'url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap")',
          '*, *::before, *::after': {
            boxSizing: 'border-box',
          },
          html: {
            fontFamily: 'Inter, Roboto, "Segoe UI", Helvetica, Arial, sans-serif',
          },
          body: {
            backgroundColor: m(ET.background, ET.dark),
            color: m(ET.text, '#F8FAFC'),
            fontFamily: 'Inter, Roboto, "Segoe UI", Helvetica, Arial, sans-serif',
            fontSize: '15px',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            scrollbarWidth: 'thin',
            scrollbarColor: m('#C8CDD2 transparent', `${ET.silver} transparent`),
            '&::-webkit-scrollbar': { width: '5px' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              borderRadius: '4px',
              background: m('#C8CDD2', ET.silver),
            },
          },
          ':focus-visible': {
            outline: `2px solid ${ET.green}`,
            outlineOffset: 2,
          },
          '.maplibregl-map, .maplibregl-ctrl, .maplibregl-popup, .maplibregl-marker': {
            fontFamily: 'Inter, Roboto, "Segoe UI", Helvetica, Arial, sans-serif',
          },
          '.maplibregl-popup-content': {
            borderRadius: 18,
            boxShadow: m('0 8px 24px rgba(15,23,42,0.10)', '0 8px 24px rgba(0,0,0,0.38)'),
          },
        },
      },

      // ── Button ────────────────────────────────────────────────────────────
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            minHeight: 48,
            borderRadius: 12,
            fontWeight: 600,
            padding: '10px 20px',
            transition:
              'background-color 150ms ease-in-out, border-color 150ms ease-in-out, box-shadow 150ms ease-in-out, transform 150ms ease-in-out',
            '&:active': { transform: 'scale(0.97)' },
          },
          containedPrimary: {
            background: ET.green,
            color: ET.dark,
            '&:hover': {
              background: ET.greenDark,
              boxShadow: `0 6px 18px ${ET.greenGlow(0.28)}`,
            },
            '&:disabled': {
              background: m('rgba(0,230,91,0.3)', 'rgba(0,230,91,0.15)'),
              color: m('rgba(33,37,41,0.5)', 'rgba(255,255,255,0.3)'),
            },
          },
          containedSecondary: {
            backgroundColor: m(ET.silver, ET.darkSoft),
            color: ET.white,
            '&:hover': {
              backgroundColor: m('#3A3F44', '#383E44'),
            },
          },
          outlined: {
            borderWidth: '1.5px',
            '&:hover': { borderWidth: '1.5px' },
          },
          outlinedPrimary: {
            borderColor: ET.green,
            color: ET.green,
            '&:hover': {
              backgroundColor: ET.greenGlow(0.08),
              borderColor: ET.green,
            },
          },
          text: {
            color: m(ET.silver, ET.silverLight),
            '&:hover': {
              backgroundColor: m('rgba(74,80,86,0.08)', 'rgba(138,144,153,0.12)'),
            },
          },
          textPrimary: {
            color: ET.green,
            '&:hover': { backgroundColor: ET.greenGlow(0.08) },
          },
          sizeSmall: {
            minHeight: 36,
            borderRadius: 10,
            padding: '6px 12px',
            fontSize: '0.8125rem',
          },
          sizeLarge: { minHeight: 52, borderRadius: 12, padding: '12px 24px', fontSize: '1rem' },
        },
      },

      MuiSvgIcon: {
        defaultProps: { fontSize: 'small' },
        styleOverrides: {
          root: { fontSize: 20 },
          fontSizeSmall: { fontSize: 20 },
          fontSizeLarge: { fontSize: 24 },
        },
      },

      // ── IconButton ────────────────────────────────────────────────────────
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition:
              'color 150ms ease-in-out, background-color 150ms ease-in-out, transform 150ms ease-in-out',
            color: m(ET.silver, ET.silverLight),
            '&:hover': {
              backgroundColor: m(ET.greenGlow(0.08), ET.greenGlow(0.12)),
              color: ET.green,
            },
            '&:active': { transform: 'scale(0.93)' },
            '&.Mui-disabled': {
              color: m('rgba(74,80,86,0.35)', 'rgba(138,144,153,0.30)'),
            },
          },
          colorPrimary: {
            color: ET.green,
            '&:hover': {
              backgroundColor: ET.greenGlow(0.1),
            },
          },
        },
      },

      // ── TextField / OutlinedInput ─────────────────────────────────────────
      MuiTextField: {
        defaultProps: { variant: 'outlined' },
      },
      MuiInputBase: {
        styleOverrides: {
          root: { fontSize: '0.9375rem' },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            minHeight: 48,
            borderRadius: 12,
            backgroundColor: m('transparent', 'rgba(255,255,255,0.03)'),
            transition: 'box-shadow 150ms ease-in-out, background-color 150ms ease-in-out',
            '&:hover': {
              backgroundColor: m('rgba(0,0,0,0.01)', 'rgba(255,255,255,0.05)'),
            },
            '&.Mui-focused': {
              boxShadow: `0 0 0 3px ${ET.greenGlow(0.18)}`,
              backgroundColor: m('rgba(0,230,91,0.02)', 'rgba(0,230,91,0.04)'),
            },
            '& fieldset': {
              borderWidth: 1,
              borderColor: m(ET.border, 'rgba(226,232,240,0.16)'),
              transition: 'border-color 150ms ease-in-out',
            },
            '&:hover fieldset': {
              borderWidth: '1.5px',
              borderColor: m('rgba(74,80,86,0.45)', 'rgba(255,255,255,0.22)'),
            },
            '&.Mui-focused fieldset': {
              borderWidth: '2px',
              borderColor: ET.green,
            },
            '&.Mui-disabled': {
              backgroundColor: m('rgba(0,0,0,0.04)', 'rgba(255,255,255,0.03)'),
            },
          },
          input: {
            padding: '13px 14px',
            fontSize: '0.9375rem',
            color: m(ET.dark, '#F0F2F4'),
            '&::placeholder': {
              color: m(ET.silverLight, ET.silver),
              opacity: 1,
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontWeight: 500,
            color: m(ET.silver, ET.silverLight),
            '&.Mui-focused': { color: ET.green },
            '&.Mui-disabled': {
              color: m('rgba(74,80,86,0.45)', 'rgba(138,144,153,0.40)'),
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: { minHeight: 48, borderRadius: 12 },
          icon: { color: m(ET.silver, ET.silverLight) },
        },
      },

      // ── Paper ─────────────────────────────────────────────────────────────
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: m(ET.white, ET.darkSoft),
            border: m(`1px solid ${ET.border}`, '1px solid rgba(226,232,240,0.10)'),
            transition:
              'background-color 150ms ease-in-out, border-color 150ms ease-in-out, box-shadow 150ms ease-in-out',
          },
          elevation0: { border: 'none' },
          elevation3: {
            border: 'none',
            boxShadow: m('0 4px 24px rgba(0,0,0,0.08)', '0 4px 24px rgba(0,0,0,0.50)'),
          },
        },
      },

      // ── Card ──────────────────────────────────────────────────────────────
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundColor: m(ET.white, ET.darkSoft),
            border: m(`1px solid ${ET.border}`, '1px solid rgba(226,232,240,0.10)'),
            boxShadow: m('0 8px 24px rgba(15,23,42,0.08)', '0 8px 24px rgba(0,0,0,0.30)'),
            transition: 'box-shadow 150ms ease-in-out, border-color 150ms ease-in-out',
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: 20,
            '&:last-child': { paddingBottom: 20 },
          },
        },
      },
      MuiCardHeader: {
        styleOverrides: {
          root: { padding: 20 },
          title: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.35 },
          subheader: { marginTop: 4, fontSize: '0.8125rem', color: m(ET.silver, ET.silverLight) },
        },
      },

      // ── ListItemButton ────────────────────────────────────────────────────
      MuiListItemButton: {
        styleOverrides: {
          root: {
            minHeight: 44,
            borderRadius: 12,
            margin: '2px 8px',
            width: 'calc(100% - 16px)',
            gap: 12,
            fontSize: '0.9375rem',
            transition: 'color 150ms ease-in-out, background-color 150ms ease-in-out',
            color: m(ET.dark, '#E0E4E8'),
            '& .MuiListItemIcon-root': {
              color: m(ET.silver, ET.silverLight),
              minWidth: 34,
              '& .MuiSvgIcon-root': { fontSize: 22 },
            },
            '&:hover': {
              backgroundColor: m(ET.greenGlow(0.07), ET.greenGlow(0.1)),
              color: m(ET.dark, ET.white),
              '& .MuiListItemIcon-root': { color: ET.green },
            },
            '&.Mui-selected': {
              fontWeight: 600,
              color: ET.green,
              backgroundColor: m(ET.greenGlow(0.1), ET.greenGlow(0.14)),
              '& .MuiListItemIcon-root': { color: ET.green },
              '& .MuiListItemText-primary': { fontWeight: 600 },
              '&:hover': {
                backgroundColor: m(ET.greenGlow(0.15), ET.greenGlow(0.2)),
              },
            },
            '&.Mui-disabled': {
              opacity: 0.45,
            },
          },
        },
      },

      // ── ListSubheader ─────────────────────────────────────────────────────
      MuiListSubheader: {
        styleOverrides: {
          root: {
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: ET.green,
            backgroundColor: 'transparent',
          },
        },
      },

      // ── Chip ──────────────────────────────────────────────────────────────
      MuiChip: {
        styleOverrides: {
          root: {
            minHeight: 28,
            borderRadius: 999,
            fontWeight: 500,
            fontSize: '0.8125rem',
            backgroundColor: m('rgba(74,80,86,0.10)', 'rgba(255,255,255,0.08)'),
            color: m(ET.dark, '#E0E4E8'),
          },
          colorPrimary: {
            backgroundColor: m(ET.greenGlow(0.12), ET.greenGlow(0.16)),
            color: m(ET.greenDark, ET.green),
            border: `1px solid ${ET.greenGlow(0.25)}`,
          },
          colorSuccess: {
            backgroundColor: m(ET.greenGlow(0.12), ET.greenGlow(0.16)),
            color: m(ET.greenDark, ET.green),
          },
          colorError: {
            backgroundColor: m('rgba(255,61,87,0.10)', 'rgba(255,61,87,0.18)'),
            color: m('#CC2640', '#FF6B80'),
          },
          colorWarning: {
            backgroundColor: m('rgba(255,184,0,0.12)', 'rgba(255,184,0,0.18)'),
            color: m('#CC9200', '#FFB800'),
          },
        },
      },

      // ── Tooltip ───────────────────────────────────────────────────────────
      MuiTooltip: {
        defaultProps: { arrow: true, enterDelay: 400, enterNextDelay: 300 },
        styleOverrides: {
          tooltip: {
            borderRadius: 10,
            fontFamily: 'Inter, Roboto, "Segoe UI", Helvetica, Arial, sans-serif',
            fontSize: '0.75rem',
            fontWeight: 500,
            padding: '8px 12px',
            backdropFilter: 'blur(8px)',
            backgroundColor: m('rgba(33,37,41,0.92)', 'rgba(20,23,26,0.95)'),
            color: ET.white,
            border: m('none', `1px solid rgba(255,255,255,0.08)`),
          },
          arrow: {
            color: m('rgba(33,37,41,0.92)', 'rgba(20,23,26,0.95)'),
          },
        },
      },

      // ── Dialog ────────────────────────────────────────────────────────────
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 18,
            backgroundColor: m(ET.white, ET.darkSoft),
            border: m('none', '1px solid rgba(255,255,255,0.07)'),
            boxShadow: m('0 24px 64px rgba(0,0,0,0.12)', '0 24px 64px rgba(0,0,0,0.60)'),
          },
          backdrop: {
            backgroundColor: m('rgba(33,37,41,0.5)', 'rgba(0,0,0,0.75)'),
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { padding: '24px 24px 12px', fontSize: '1.25rem', fontWeight: 600 },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: { padding: '12px 24px 24px' },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: { padding: '12px 24px 24px', gap: 8 },
        },
      },

      // ── AppBar ────────────────────────────────────────────────────────────
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backdropFilter: 'blur(12px)',
            backgroundColor: m('rgba(255,255,255,0.90)', 'rgba(33,37,41,0.90)'),
            color: m(ET.dark, '#F0F2F4'),
            borderBottom: m('1px solid rgba(33,37,41,0.08)', '1px solid rgba(255,255,255,0.06)'),
          },
        },
      },

      // ── Drawer ────────────────────────────────────────────────────────────
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: m(ET.white, ET.darkSoft),
            borderRight: m(`1px solid ${ET.border}`, '1px solid rgba(226,232,240,0.10)'),
          },
        },
      },

      // ── BottomNavigation ──────────────────────────────────────────────────
      MuiBottomNavigation: {
        styleOverrides: {
          root: {
            backgroundColor: m(ET.white, ET.darkSoft),
            borderTop: m('1px solid rgba(33,37,41,0.08)', '1px solid rgba(255,255,255,0.06)'),
          },
        },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: {
            transition: 'all 0.18s ease',
            borderRadius: 10,
            color: m(ET.silver, ET.silverLight),
            '&.Mui-selected': {
              color: ET.green,
              fontWeight: 600,
            },
          },
          label: {
            fontWeight: 500,
            '&.Mui-selected': { fontWeight: 700 },
          },
        },
      },

      // ── Divider ───────────────────────────────────────────────────────────
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: m('rgba(33,37,41,0.09)', 'rgba(255,255,255,0.07)'),
          },
        },
      },

      // ── Badge ─────────────────────────────────────────────────────────────
      MuiBadge: {
        styleOverrides: {
          badge: { fontWeight: 700, fontSize: '0.65rem' },
          colorPrimary: {
            backgroundColor: ET.green,
            color: ET.dark,
          },
        },
      },

      // ── Switch ────────────────────────────────────────────────────────────
      MuiSwitch: {
        styleOverrides: {
          root: { padding: 6 },
          thumb: {
            boxShadow: m('0 2px 4px rgba(0,0,0,0.20)', '0 2px 4px rgba(0,0,0,0.50)'),
            backgroundColor: m(ET.white, '#CDD1D6'),
          },
          track: {
            borderRadius: 20,
            opacity: 1,
            backgroundColor: m('#C8CDD2', '#3A3F44'),
          },
          colorPrimary: {
            '&.Mui-checked': {
              color: ET.white,
              '& + .MuiSwitch-track': {
                backgroundColor: ET.green,
                opacity: 1,
              },
              '& .MuiSwitch-thumb': {
                backgroundColor: ET.white,
              },
            },
          },
        },
      },

      // ── Checkbox / Radio ──────────────────────────────────────────────────
      MuiCheckbox: {
        styleOverrides: {
          root: {
            color: m('rgba(74,80,86,0.50)', 'rgba(138,144,153,0.50)'),
            '&.Mui-checked': { color: ET.green },
          },
        },
      },
      MuiRadio: {
        styleOverrides: {
          root: {
            color: m('rgba(74,80,86,0.50)', 'rgba(138,144,153,0.50)'),
            '&.Mui-checked': { color: ET.green },
          },
        },
      },

      // ── Table ─────────────────────────────────────────────────────────────
      MuiTableHead: {
        styleOverrides: {
          root: {
            backgroundColor: m('#F8FAFC', 'rgba(226,232,240,0.06)'),
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: m(`1px solid ${ET.border}`, '1px solid rgba(226,232,240,0.10)'),
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            padding: '14px 16px',
            borderBottomColor: m(ET.border, 'rgba(226,232,240,0.10)'),
            color: m(ET.dark, '#E0E4E8'),
            fontSize: '0.9375rem',
          },
          head: {
            fontWeight: 600,
            fontSize: '1rem',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: m(ET.text, '#E2E8F0'),
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color 150ms ease-in-out',
            '&:hover': {
              backgroundColor: m('#F1F5F9', ET.greenGlow(0.08)),
            },
            '&.Mui-selected': { backgroundColor: m('#DCFCE7', ET.greenGlow(0.16)) },
          },
        },
      },

      // ── Alert ─────────────────────────────────────────────────────────────
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 10, fontWeight: 500 },
          standardSuccess: {
            backgroundColor: m(ET.greenGlow(0.1), ET.greenGlow(0.14)),
            color: m(ET.greenDark, ET.greenLight),
          },
          standardError: {
            backgroundColor: m('rgba(255,61,87,0.10)', 'rgba(255,61,87,0.16)'),
            color: m('#CC2640', '#FF6B80'),
          },
          standardWarning: {
            backgroundColor: m('rgba(255,184,0,0.10)', 'rgba(255,184,0,0.16)'),
            color: m('#CC9200', '#FFB800'),
          },
          standardInfo: {
            backgroundColor: m('rgba(33,150,243,0.10)', 'rgba(33,150,243,0.16)'),
            color: m('#1565C0', '#64B5F6'),
          },
        },
      },

      // ── LinearProgress ────────────────────────────────────────────────────
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            height: 6,
            backgroundColor: m('rgba(0,230,91,0.15)', 'rgba(0,230,91,0.12)'),
          },
          bar: {
            background: `linear-gradient(90deg, ${ET.green}, ${ET.greenDark})`,
          },
        },
      },

      // ── CircularProgress ──────────────────────────────────────────────────
      MuiCircularProgress: {
        defaultProps: { color: 'primary' },
        styleOverrides: {
          colorPrimary: { color: ET.green },
        },
      },

      // ── Tabs ──────────────────────────────────────────────────────────────
      MuiTab: {
        styleOverrides: {
          root: {
            fontWeight: 500,
            textTransform: 'none',
            color: m(ET.silver, ET.silverLight),
            '&.Mui-selected': {
              color: ET.green,
              fontWeight: 700,
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: { backgroundColor: ET.green, height: 3, borderRadius: 2 },
        },
      },

      // ── Snackbar ──────────────────────────────────────────────────────────
      MuiSnackbarContent: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            padding: '10px 16px',
            fontSize: '0.8125rem',
            backgroundColor: m(ET.dark, '#1A1D20'),
            color: ET.white,
            boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
          },
        },
      },

      // ── Menu / MenuItem ───────────────────────────────────────────────────
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 14,
            backgroundColor: m(ET.white, ET.darkSoft),
            border: m('1px solid rgba(33,37,41,0.10)', '1px solid rgba(255,255,255,0.08)'),
            boxShadow: m('0 8px 32px rgba(0,0,0,0.10)', '0 8px 32px rgba(0,0,0,0.55)'),
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            minHeight: 40,
            borderRadius: 10,
            margin: '2px 6px',
            width: 'calc(100% - 12px)',
            fontSize: '0.9375rem',
            fontWeight: 400,
            color: m(ET.dark, '#E0E4E8'),
            '&:hover': {
              backgroundColor: m(ET.greenGlow(0.07), ET.greenGlow(0.1)),
            },
            '&.Mui-selected': {
              backgroundColor: m(ET.greenGlow(0.1), ET.greenGlow(0.14)),
              color: ET.green,
              fontWeight: 600,
              '&:hover': {
                backgroundColor: m(ET.greenGlow(0.14), ET.greenGlow(0.18)),
              },
            },
          },
        },
      },

      // ── Toolbar ───────────────────────────────────────────────────────────
      MuiToolbar: {
        styleOverrides: {
          root: {
            backgroundColor: m(ET.white, ET.darkSoft),
            gap: 8,
          },
        },
      },
      MuiLink: {
        styleOverrides: {
          root: {
            fontWeight: 500,
            textUnderlineOffset: 3,
            transition: 'color 150ms ease-in-out',
          },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            borderRadius: 18,
            boxShadow: m('0 8px 24px rgba(15,23,42,0.10)', '0 8px 24px rgba(0,0,0,0.38)'),
          },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: { marginTop: 6, fontSize: '0.75rem', lineHeight: 1.5 },
        },
      },
      MuiFormLabel: {
        styleOverrides: {
          root: { fontSize: '0.8125rem', fontWeight: 500 },
        },
      },
    },
  });

  return (
    <ColorModeContext.Provider value={{ darkMode, toggleDarkMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};

export default AppThemeProvider;

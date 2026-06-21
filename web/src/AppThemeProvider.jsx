import React, { createContext, useContext } from 'react';
import { useSelector } from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import usePersistedState from './common/util/usePersistedState';
import dimensions from './common/theme/dimensions';
import palette from './common/theme/palette';

// ── Tokens de marca EliteTrack ────────────────────────────────────────────────
const ET = {
  green:        '#00E65B',
  greenDark:    '#00B848',
  greenLight:   '#33FF7A',
  greenGlow:    (alpha) => `rgba(0,230,91,${alpha})`,
  dark:         '#212529',
  darkSoft:     '#2C3136',
  silver:       '#4A5056',
  silverLight:  '#8A9099',
  white:        '#FFFFFF',
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
      fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
      fontWeightLight:   300,
      fontWeightRegular: 400,
      fontWeightMedium:  500,
      fontWeightBold:    700,
      h1: { fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1 },
      h2: { fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2 },
      h3: { fontWeight: 700, letterSpacing: '-0.02em' },
      h4: { fontWeight: 600, letterSpacing: '-0.015em' },
      h5: { fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600, letterSpacing: '-0.005em' },
      subtitle1: { fontWeight: 500, letterSpacing: '-0.005em' },
      subtitle2: { fontWeight: 500 },
      body1: { letterSpacing: '-0.005em', lineHeight: 1.6 },
      body2: { letterSpacing: '-0.003em', lineHeight: 1.5 },
      button: { fontWeight: 600, letterSpacing: '0.01em', textTransform: 'none' },
      caption: { letterSpacing: '0.01em' },
      overline: { fontWeight: 700, letterSpacing: '0.1em' },
    },

    shape: { borderRadius: 10 },

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
          '@import': 'url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap")',
          body: {
            backgroundColor: m('#F4F6F8', ET.dark),
            color: m(ET.dark, '#F0F2F4'),
            scrollbarWidth: 'thin',
            scrollbarColor: m('#C8CDD2 transparent', `${ET.silver} transparent`),
            '&::-webkit-scrollbar': { width: '5px' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              borderRadius: '4px',
              background: m('#C8CDD2', ET.silver),
            },
          },
        },
      },

      // ── Button ────────────────────────────────────────────────────────────
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 10,
            fontWeight: 600,
            padding: '8px 18px',
            transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
            '&:active': { transform: 'scale(0.97)' },
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${ET.green} 0%, ${ET.greenDark} 100%)`,
            color: ET.dark,
            '&:hover': {
              background: `linear-gradient(135deg, ${ET.greenLight} 0%, ${ET.green} 100%)`,
              boxShadow: `0 4px 20px ${ET.greenGlow(0.40)}`,
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
          sizeSmall:  { borderRadius: 8,  padding: '5px 12px',  fontSize: '0.8125rem' },
          sizeLarge:  { borderRadius: 12, padding: '11px 24px', fontSize: '1rem' },
        },
      },

      // ── IconButton ────────────────────────────────────────────────────────
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
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
              backgroundColor: ET.greenGlow(0.10),
            },
          },
        },
      },

      // ── TextField / OutlinedInput ─────────────────────────────────────────
      MuiTextField: {
        defaultProps: { size: 'small', variant: 'outlined' },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: m('transparent', 'rgba(255,255,255,0.03)'),
            transition: 'box-shadow 0.2s ease, background-color 0.2s ease',
            '&:hover': {
              backgroundColor: m('rgba(0,0,0,0.01)', 'rgba(255,255,255,0.05)'),
            },
            '&.Mui-focused': {
              boxShadow: `0 0 0 3px ${ET.greenGlow(0.18)}`,
              backgroundColor: m('rgba(0,230,91,0.02)', 'rgba(0,230,91,0.04)'),
            },
            '& fieldset': {
              borderWidth: '1.5px',
              borderColor: m('rgba(74,80,86,0.25)', 'rgba(255,255,255,0.12)'),
              transition: 'border-color 0.2s ease',
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
          root: { borderRadius: 10 },
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
            border: m(
              '1px solid rgba(33,37,41,0.08)',
              '1px solid rgba(255,255,255,0.06)',
            ),
            transition: 'background-color 0.25s ease, border-color 0.25s ease',
          },
          elevation0: { border: 'none' },
          elevation3: {
            border: 'none',
            boxShadow: m(
              '0 4px 24px rgba(0,0,0,0.08)',
              '0 4px 24px rgba(0,0,0,0.50)',
            ),
          },
        },
      },

      // ── Card ──────────────────────────────────────────────────────────────
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            backgroundColor: m(ET.white, ET.darkSoft),
            border: m(
              '1px solid rgba(33,37,41,0.08)',
              '1px solid rgba(255,255,255,0.06)',
            ),
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            '&:hover': { transform: 'translateY(-2px)' },
          },
        },
      },

      // ── ListItemButton ────────────────────────────────────────────────────
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            margin: '1px 6px',
            width: 'calc(100% - 12px)',
            transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
            color: m(ET.dark, '#E0E4E8'),
            '& .MuiListItemIcon-root': {
              color: m(ET.silver, ET.silverLight),
            },
            '&:hover': {
              backgroundColor: m(ET.greenGlow(0.07), ET.greenGlow(0.10)),
              color: m(ET.dark, ET.white),
              '& .MuiListItemIcon-root': { color: ET.green },
            },
            '&.Mui-selected': {
              fontWeight: 600,
              color: ET.green,
              backgroundColor: m(ET.greenGlow(0.10), ET.greenGlow(0.14)),
              '& .MuiListItemIcon-root': { color: ET.green },
              '& .MuiListItemText-primary': { fontWeight: 600 },
              '&:hover': {
                backgroundColor: m(ET.greenGlow(0.15), ET.greenGlow(0.20)),
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
            borderRadius: 8,
            fontWeight: 500,
            fontSize: '0.8rem',
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
        defaultProps: { arrow: true },
        styleOverrides: {
          tooltip: {
            borderRadius: 8,
            fontSize: '0.75rem',
            fontWeight: 500,
            padding: '6px 10px',
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
            borderRadius: 16,
            backgroundColor: m(ET.white, ET.darkSoft),
            border: m('none', '1px solid rgba(255,255,255,0.07)'),
            boxShadow: m(
              '0 24px 64px rgba(0,0,0,0.12)',
              '0 24px 64px rgba(0,0,0,0.60)',
            ),
          },
          backdrop: {
            backgroundColor: m('rgba(33,37,41,0.5)', 'rgba(0,0,0,0.75)'),
          },
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
            borderBottom: m(
              '1px solid rgba(33,37,41,0.08)',
              '1px solid rgba(255,255,255,0.06)',
            ),
          },
        },
      },

      // ── Drawer ────────────────────────────────────────────────────────────
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: m(ET.white, ET.darkSoft),
            borderRight: m(
              '1px solid rgba(33,37,41,0.08)',
              '1px solid rgba(255,255,255,0.06)',
            ),
          },
        },
      },

      // ── BottomNavigation ──────────────────────────────────────────────────
      MuiBottomNavigation: {
        styleOverrides: {
          root: {
            backgroundColor: m(ET.white, ET.darkSoft),
            borderTop: m(
              '1px solid rgba(33,37,41,0.08)',
              '1px solid rgba(255,255,255,0.06)',
            ),
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
            boxShadow: m(
              '0 2px 4px rgba(0,0,0,0.20)',
              '0 2px 4px rgba(0,0,0,0.50)',
            ),
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
            backgroundColor: m('rgba(0,230,91,0.06)', 'rgba(0,230,91,0.08)'),
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottomColor: m('rgba(33,37,41,0.08)', 'rgba(255,255,255,0.06)'),
            color: m(ET.dark, '#E0E4E8'),
          },
          head: {
            fontWeight: 700,
            fontSize: '0.75rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: ET.green,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: m(ET.greenGlow(0.04), ET.greenGlow(0.06)),
            },
          },
        },
      },

      // ── Alert ─────────────────────────────────────────────────────────────
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 10, fontWeight: 500 },
          standardSuccess: {
            backgroundColor: m(ET.greenGlow(0.10), ET.greenGlow(0.14)),
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
            borderRadius: 10,
            backgroundColor: m(ET.dark, '#1A1D20'),
            color: ET.white,
          },
        },
      },

      // ── Menu / MenuItem ───────────────────────────────────────────────────
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            backgroundColor: m(ET.white, ET.darkSoft),
            border: m(
              '1px solid rgba(33,37,41,0.10)',
              '1px solid rgba(255,255,255,0.08)',
            ),
            boxShadow: m(
              '0 8px 32px rgba(0,0,0,0.10)',
              '0 8px 32px rgba(0,0,0,0.55)',
            ),
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            margin: '1px 4px',
            width: 'calc(100% - 8px)',
            fontSize: '0.875rem',
            fontWeight: 400,
            color: m(ET.dark, '#E0E4E8'),
            '&:hover': {
              backgroundColor: m(ET.greenGlow(0.07), ET.greenGlow(0.10)),
            },
            '&.Mui-selected': {
              backgroundColor: m(ET.greenGlow(0.10), ET.greenGlow(0.14)),
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
          },
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

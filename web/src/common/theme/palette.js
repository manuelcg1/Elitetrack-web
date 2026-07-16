const validatedColor = (color) => (/^#([0-9A-Fa-f]{3}){1,2}$/.test(color) ? color : null);

// ── Colores de marca EliteTrack ───────────────────────────────────────────────
const brand = {
  green: '#00C853', // verde principal
  greenDark: '#00B248', // verde oscuro (hover)
  greenLight: '#DCFCE7', // verde claro (acentos)
  dark: '#0F172A', // azul carbón
  darkSoft: '#172033', // superficie oscura
  silver: '#64748B', // texto secundario
  silverLight: '#94A3B8', // texto secundario oscuro
  white: '#FFFFFF',
};

export default (server, darkMode) => ({
  mode: darkMode ? 'dark' : 'light',

  // ── Primary — verde EliteTrack ─────────────────────────────────────────────
  primary: {
    main: validatedColor(server?.attributes?.colorPrimary) || brand.green,
    light: brand.greenLight,
    dark: brand.greenDark,
    contrastText: brand.dark,
  },

  // ── Secondary — plata EliteTrack ───────────────────────────────────────────
  secondary: {
    main: validatedColor(server?.attributes?.colorSecondary) || brand.silver,
    light: brand.silverLight,
    dark: '#353A40',
    contrastText: brand.white,
  },

  // ── Background ─────────────────────────────────────────────────────────────
  background: {
    default: darkMode ? brand.dark : '#F8FAFC',
    paper: darkMode ? brand.darkSoft : brand.white,
  },

  // ── Text ───────────────────────────────────────────────────────────────────
  text: {
    primary: darkMode ? '#F8FAFC' : '#1E293B',
    secondary: darkMode ? brand.silverLight : brand.silver,
    disabled: darkMode ? '#555C64' : '#B0B8C1',
  },

  // ── Divider ────────────────────────────────────────────────────────────────
  divider: darkMode ? 'rgba(226,232,240,0.12)' : '#E2E8F0',

  // ── Action states ──────────────────────────────────────────────────────────
  action: {
    hover: darkMode ? 'rgba(0,200,83,0.10)' : '#F1F5F9',
    selected: darkMode ? 'rgba(0,200,83,0.18)' : '#DCFCE7',
    focus: darkMode ? 'rgba(0,200,83,0.16)' : 'rgba(0,200,83,0.12)',
    disabledBackground: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
  },

  // ── Semánticos ─────────────────────────────────────────────────────────────
  success: {
    main: '#00C853',
    light: '#DCFCE7',
    dark: '#00B248',
    contrastText: brand.dark,
  },
  warning: {
    main: '#FFB800',
    light: '#FFCF4D',
    dark: '#CC9200',
    contrastText: brand.dark,
  },
  error: {
    main: '#FF3D57',
    light: '#FF6B80',
    dark: '#CC2640',
    contrastText: brand.white,
  },
  info: {
    main: '#2196F3',
    light: '#64B5F6',
    dark: '#1565C0',
    contrastText: brand.white,
  },

  // ── Colores personalizados (usados en DeviceRow, etc.) ─────────────────────
  neutral: {
    main: brand.silverLight,
  },
  geometry: {
    main: brand.green,
  },
  alwaysDark: {
    main: brand.dark,
  },
});

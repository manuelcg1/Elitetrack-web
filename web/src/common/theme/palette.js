import { grey } from "@mui/material/colors";

const validatedColor = (color) =>
  /^#([0-9A-Fa-f]{3}){1,2}$/.test(color) ? color : null;

// ── Colores de marca EliteTrack ───────────────────────────────────────────────
const brand = {
  green: "#00E65B", // verde principal
  greenDark: "#00B848", // verde oscuro (hover)
  greenLight: "#33FF7A", // verde claro (acentos)
  dark: "#212529", // negro carbón
  darkSoft: "#2C3136", // negro suave (superficies dark)
  silver: "#4A5056", // plata
  silverLight: "#8A9099", // plata clara
  white: "#FFFFFF",
};

export default (server, darkMode) => ({
  mode: darkMode ? "dark" : "light",

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
    dark: "#353A40",
    contrastText: brand.white,
  },

  // ── Background ─────────────────────────────────────────────────────────────
  background: {
    default: darkMode ? brand.dark : "#F4F6F8",
    paper: darkMode ? brand.darkSoft : brand.white,
  },

  // ── Text ───────────────────────────────────────────────────────────────────
  text: {
    primary: darkMode ? "#F0F2F4" : brand.dark,
    secondary: darkMode ? brand.silverLight : brand.silver,
    disabled: darkMode ? "#555C64" : "#B0B8C1",
  },

  // ── Divider ────────────────────────────────────────────────────────────────
  divider: darkMode ? "rgba(255,255,255,0.07)" : "rgba(33,37,41,0.10)",

  // ── Action states ──────────────────────────────────────────────────────────
  action: {
    hover: darkMode ? "rgba(0,230,91,0.07)" : "rgba(0,230,91,0.06)",
    selected: darkMode ? "rgba(0,230,91,0.14)" : "rgba(0,230,91,0.12)",
    focus: darkMode ? "rgba(0,230,91,0.12)" : "rgba(0,230,91,0.10)",
    disabledBackground: darkMode
      ? "rgba(255,255,255,0.06)"
      : "rgba(0,0,0,0.06)",
  },

  // ── Semánticos ─────────────────────────────────────────────────────────────
  success: {
    main: "#00E65B",
    light: "#33FF7A",
    dark: "#00B848",
    contrastText: brand.dark,
  },
  warning: {
    main: "#FFB800",
    light: "#FFCF4D",
    dark: "#CC9200",
    contrastText: brand.dark,
  },
  error: {
    main: "#FF3D57",
    light: "#FF6B80",
    dark: "#CC2640",
    contrastText: brand.white,
  },
  info: {
    main: "#2196F3",
    light: "#64B5F6",
    dark: "#1565C0",
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

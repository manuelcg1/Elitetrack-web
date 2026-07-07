import { List, ListItemButton, ListItemIcon, ListItemText, Divider, Tooltip } from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useColorMode } from '../../AppThemeProvider';

// ─── Agrega este bloque al final de tu SideNav existente ──────────────────────
// Si ya tienes un componente SideNav, simplemente copia el import de useColorMode
// y el bloque <DarkModeToggle /> donde quieras posicionarlo.

const DarkModeToggle = () => {
  const { darkMode, toggleDarkMode } = useColorMode();

  return (
    <>
      <Divider />
      <List disablePadding>
        <Tooltip
          title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          placement="right"
        >
          <ListItemButton onClick={toggleDarkMode}>
            <ListItemIcon>{darkMode ? <LightModeIcon /> : <DarkModeIcon />}</ListItemIcon>
            <ListItemText primary={darkMode ? 'Modo claro' : 'Modo oscuro'} />
          </ListItemButton>
        </Tooltip>
      </List>
    </>
  );
};

export default DarkModeToggle;

import { List } from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useLocation } from 'react-router-dom';
import MenuItem from '../../common/components/MenuItem';
import { COMPACT_DESKTOP_DRAWER_WIDTH } from '../../common/theme/navigation';

const RolesMenu = () => {
  const location = useLocation();

  return (
    <List>
      <MenuItem
        title="Rol"
        link="/roles/rol"
        icon={<AdminPanelSettingsIcon />}
        selected={location.pathname === '/roles/rol'}
      />
    </List>
  );
};

RolesMenu.desktopDrawerWidth = COMPACT_DESKTOP_DRAWER_WIDTH;
RolesMenu.compactDesktopMenu = true;

export default RolesMenu;

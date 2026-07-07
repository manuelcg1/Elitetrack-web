import { List } from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useLocation } from 'react-router-dom';
import MenuItem from '../../common/components/MenuItem';

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

export default RolesMenu;

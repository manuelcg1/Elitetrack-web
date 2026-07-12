import { List } from '@mui/material';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import StorageIcon from '@mui/icons-material/Storage';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import EngineeringIcon from '@mui/icons-material/Engineering';
import InventoryIcon from '@mui/icons-material/Inventory2';

import { useLocation } from 'react-router-dom';

import MenuItem from '../common/components/MenuItem';
import { COMPACT_DESKTOP_DRAWER_WIDTH } from '../common/theme/navigation';

const MonitoringMenu = () => {
  const location = useLocation();

  return (
    <List>
      <MenuItem
        title="Salud GPS"
        link="/monitoring/health"
        icon={<MonitorHeartIcon />}
        selected={location.pathname === '/monitoring/health'}
      />

      <MenuItem
        title="Mantenimiento"
        link="/monitoring/mantenimiento"
        icon={<EngineeringIcon />}
        selected={location.pathname === '/monitoring/mantenimiento'}
      />

      <MenuItem
        title="Inventario GPS"
        link="/monitoring/gps-inventory"
        icon={<InventoryIcon />}
        selected={location.pathname.startsWith('/monitoring/gps-inventory')}
      />

      <MenuItem
        title="Alertas"
        link="/monitoring/alerts"
        icon={<CampaignRoundedIcon />}
        selected={location.pathname === '/monitoring/alerts'}
      />

      <MenuItem
        title="Retransmisión"
        link="/monitoring/forwarder"
        icon={<SyncAltIcon />}
        selected={location.pathname === '/monitoring/forwarder'}
      />

      <MenuItem
        title="Servidor"
        link="/monitoring/server"
        icon={<StorageIcon />}
        selected={location.pathname === '/monitoring/server'}
      />
    </List>
  );
};

MonitoringMenu.desktopDrawerWidth = COMPACT_DESKTOP_DRAWER_WIDTH;
MonitoringMenu.compactDesktopMenu = true;

export default MonitoringMenu;

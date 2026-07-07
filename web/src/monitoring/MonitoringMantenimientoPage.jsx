import { Box, Typography } from '@mui/material';
import PageLayout from '../common/components/PageLayout';
import MonitoringMenu from './MonitoringMenu';

const MonitoringMantenimientoPage = () => (
  <PageLayout menu={<MonitoringMenu />} breadcrumbs={['Monitoreo', 'Mantenimiento']}>
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 800 }}>
        Mantenimiento
      </Typography>
      <Typography color="text.secondary">Módulo en preparación M.</Typography>
    </Box>
  </PageLayout>
);

export default MonitoringMantenimientoPage;

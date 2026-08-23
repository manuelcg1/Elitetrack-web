import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InventoryIcon from '@mui/icons-material/Inventory2Outlined';
import LinkIcon from '@mui/icons-material/Link';
import BuildIcon from '@mui/icons-material/BuildOutlined';
import EventIcon from '@mui/icons-material/EventNoteOutlined';
import PageLayout from '../../common/components/PageLayout';
import MonitoringMenu from '../MonitoringMenu';
import { useEffectAsync } from '../../reactHelper';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { useRestriction } from '../../common/util/permissions';
import GpsStatusBadge from './GpsStatusBadge';
import GpsInspectionDialog from './GpsInspectionDialog';
import GpsAssignmentDialog from './GpsAssignmentDialog';

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat('es-PE', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      }).format(new Date(value))
    : 'Sin fecha registrada';

const eventLabels = {
  REGISTERED: 'Registrado',
  ASSIGNED: 'Asignado',
  UNASSIGNED: 'Retirado',
  REASSIGNED: 'Reasignado',
  INSPECTION_STARTED: 'Revisión iniciada',
  INSPECTION_COMPLETED: 'Revisión completada',
  RETIRED: 'Dado de baja',
  REACTIVATED: 'Reactivado',
};

const EmptyState = ({ children }) => (
  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
    {children}
  </Typography>
);

const Section = ({ icon, title, count, children }) => (
  <Paper variant="outlined" sx={{ p: 2 }}>
    <Stack direction="row" alignItems="center" spacing={1}>
      {icon}
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <Chip size="small" label={count} />
    </Stack>
    <Divider sx={{ my: 1.5 }} />
    {children}
  </Paper>
);

const HistoryRow = ({ date, title, subtitle, notes }) => (
  <Box
    sx={{ py: 1.25, '&:not(:last-child)': { borderBottom: '1px solid', borderColor: 'divider' } }}
  >
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={0.5}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {formatDate(date)}
      </Typography>
    </Stack>
    {subtitle && (
      <Typography variant="body2" color="text.secondary">
        {subtitle}
      </Typography>
    )}
    {notes && (
      <Typography variant="caption" color="text.secondary">
        {notes}
      </Typography>
    )}
  </Box>
);

const GpsInventoryHistoryPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const readonly = useRestriction('readonly');
  const devices = useSelector((state) => Object.values(state.devices.items));
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revision, setRevision] = useState(0);
  const [inspectionDialog, setInspectionDialog] = useState(false);
  const [assignmentAction, setAssignmentAction] = useState(null);

  useEffectAsync(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchOrThrow(`/api/gps-inventory/${id}/history?limit=500`);
      setHistory(await response.json());
    } catch (exception) {
      setError(exception.message);
    } finally {
      setLoading(false);
    }
  }, [id, revision]);

  const inventory = history?.inventory;
  const assignments = useMemo(() => history?.assignments || [], [history]);
  const inspections = history?.inspections || [];
  const events = history?.events || [];
  const currentAssignment = useMemo(
    () => assignments.find((assignment) => !assignment.unassignedAt),
    [assignments],
  );
  const currentDeviceId = currentAssignment?.deviceId || inventory?.deviceId || null;
  const hasCurrentDevice = Boolean(currentDeviceId);
  const currentDevice = devices.find((device) => device.id === currentDeviceId);
  const activeInspection = inspections.find((inspection) => !inspection.completedAt);

  const submitInspection = async (data) => {
    const endpoint = activeInspection
      ? `/api/gps-inventory/${id}/inspections/${activeInspection.id}/complete`
      : `/api/gps-inventory/${id}/inspections`;
    await fetchOrThrow(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setRevision((value) => value + 1);
  };

  const submitAssignment = async (data) => {
    const payload =
      assignmentAction === 'unassign'
        ? { reason: data.reason, targetStatus: data.targetStatus, notes: data.notes }
        : { deviceId: data.deviceId, reason: data.reason, notes: data.notes };
    const endpoint =
      assignmentAction === 'assign'
        ? `/api/gps-inventory/${id}/assignments`
        : `/api/gps-inventory/${id}/assignments/${assignmentAction}`;
    await fetchOrThrow(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setRevision((value) => value + 1);
  };

  return (
    <PageLayout menu={<MonitoringMenu />} breadcrumbs={['monitoringTitle', 'gpsInventoryTitle']}>
      <Box sx={{ p: { xs: 1.5, md: 2.5 }, overflowY: 'auto', height: '100%' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/monitoring/gps-inventory')}>
          Volver al inventario
        </Button>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={34} />
          </Box>
        )}

        {!loading && error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            No fue posible cargar la trazabilidad. {error}
          </Alert>
        )}

        {!loading && !error && inventory && (
          <Stack spacing={2} sx={{ mt: 1.5, maxWidth: 1100, mx: 'auto' }}>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <InventoryIcon color="primary" />
                  <Box>
                    <Typography variant="h6">IMEI {inventory.imei}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {[inventory.brand, inventory.model, inventory.serialNumber]
                        .filter(Boolean)
                        .join(' · ') || 'Sin detalles del equipo'}
                    </Typography>
                  </Box>
                </Stack>
                <GpsStatusBadge status={inventory.status} />
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Fecha de registro
                  </Typography>
                  <Typography variant="body2">{formatDate(inventory.registeredAt)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Asignación actual
                  </Typography>
                  <Typography variant="body2">
                    {currentAssignment?.deviceNameSnapshot ||
                      currentDevice?.name ||
                      (hasCurrentDevice
                        ? `Dispositivo ${currentDeviceId}`
                        : 'Sin dispositivo asignado')}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Fecha de baja
                  </Typography>
                  <Typography variant="body2">{formatDate(inventory.retiredAt)}</Typography>
                </Box>
              </Stack>
            </Paper>

            <Section
              icon={<LinkIcon color="primary" />}
              title="Asignaciones"
              count={assignments.length}
            >
              {!readonly && !activeInspection && (
                <Stack direction="row" spacing={1} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
                  {!hasCurrentDevice ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setAssignmentAction('assign')}
                    >
                      Asignar dispositivo
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setAssignmentAction('reassign')}
                      >
                        Reasignar
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        onClick={() => setAssignmentAction('unassign')}
                      >
                        Retirar del dispositivo
                      </Button>
                    </>
                  )}
                </Stack>
              )}
              {assignments.length ? (
                assignments.map((assignment) => (
                  <HistoryRow
                    key={assignment.id}
                    date={assignment.assignedAt}
                    title={
                      assignment.deviceNameSnapshot ||
                      `Dispositivo ${assignment.deviceId || 'eliminado'}`
                    }
                    subtitle={`Identificador: ${assignment.deviceUniqueIdSnapshot || 'sin registro'} · ${
                      assignment.unassignedAt
                        ? `Retirado ${formatDate(assignment.unassignedAt)}`
                        : 'Asignación activa'
                    }`}
                    notes={
                      assignment.unassignmentReason ||
                      assignment.assignmentReason ||
                      assignment.notes
                    }
                  />
                ))
              ) : (
                <EmptyState>No existen asignaciones registradas.</EmptyState>
              )}
            </Section>

            <Section
              icon={<BuildIcon color="primary" />}
              title="Revisiones técnicas"
              count={inspections.length}
            >
              {!readonly && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<BuildIcon />}
                  onClick={() => setInspectionDialog(true)}
                  sx={{ mb: 1 }}
                >
                  {activeInspection ? 'Completar revisión activa' : 'Iniciar revisión técnica'}
                </Button>
              )}
              {inspections.length ? (
                inspections.map((inspection) => (
                  <HistoryRow
                    key={inspection.id}
                    date={inspection.startedAt}
                    title={
                      inspection.result ||
                      (inspection.completedAt ? 'Revisión completada' : 'En revisión')
                    }
                    subtitle={
                      inspection.completedAt
                        ? `Finalizada ${formatDate(inspection.completedAt)}`
                        : 'Pendiente'
                    }
                    notes={inspection.findings || inspection.actionsTaken || inspection.notes}
                  />
                ))
              ) : (
                <EmptyState>No existen revisiones técnicas registradas.</EmptyState>
              )}
            </Section>

            <Section
              icon={<EventIcon color="primary" />}
              title="Línea de tiempo"
              count={events.length}
            >
              {events.length ? (
                events.map((event) => (
                  <HistoryRow
                    key={event.id}
                    date={event.eventTime}
                    title={eventLabels[event.eventType] || event.eventType}
                    subtitle={event.deviceNameSnapshot}
                    notes={event.notes}
                  />
                ))
              ) : (
                <EmptyState>No existen eventos de ciclo de vida registrados.</EmptyState>
              )}
            </Section>
          </Stack>
        )}
        <GpsInspectionDialog
          open={inspectionDialog}
          inspection={activeInspection}
          onClose={() => setInspectionDialog(false)}
          onSubmit={submitInspection}
        />
        <GpsAssignmentDialog
          open={Boolean(assignmentAction)}
          action={assignmentAction}
          devices={devices}
          currentDeviceId={currentDeviceId}
          onClose={() => setAssignmentAction(null)}
          onSubmit={submitAssignment}
        />
      </Box>
    </PageLayout>
  );
};

export default GpsInventoryHistoryPage;

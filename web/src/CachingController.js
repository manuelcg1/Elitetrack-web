import { useDispatch, useSelector, connect } from 'react-redux';
import {
  geofencesActions,
  groupsActions,
  driversActions,
  maintenancesActions,
  calendarsActions,
} from './store';
import { useEffectAsync } from './reactHelper';
import fetchOrThrow from './common/util/fetchOrThrow';
import { useMenuAccess } from './common/util/permissions';

const CachingController = () => {
  const authenticated = useSelector((state) => !!state.session.user);
  const vehiclesAccess = useMenuAccess('vehicles');
  const geofencesAccess = useMenuAccess('geofences');
  const mapAccess = useMenuAccess('map');
  const reportsAccess = useMenuAccess('reports');
  const settingsAccess = useMenuAccess('settings');
  const monitoringAccess = useMenuAccess('monitoring');
  const dispatch = useDispatch();

  useEffectAsync(async () => {
    if (
      authenticated &&
      (geofencesAccess || mapAccess || reportsAccess || settingsAccess || monitoringAccess)
    ) {
      const response = await fetchOrThrow('/api/geofences');
      dispatch(geofencesActions.refresh(await response.json()));
    }
  }, [authenticated, geofencesAccess, mapAccess, reportsAccess, settingsAccess, monitoringAccess]);

  useEffectAsync(async () => {
    if (authenticated && (vehiclesAccess || reportsAccess || settingsAccess || monitoringAccess)) {
      const response = await fetchOrThrow('/api/groups');
      dispatch(groupsActions.refresh(await response.json()));
    }
  }, [authenticated, vehiclesAccess, reportsAccess, settingsAccess, monitoringAccess]);

  useEffectAsync(async () => {
    if (authenticated && settingsAccess) {
      const response = await fetchOrThrow('/api/drivers');
      dispatch(driversActions.refresh(await response.json()));
    }
  }, [authenticated, settingsAccess]);

  useEffectAsync(async () => {
    if (authenticated && settingsAccess) {
      const response = await fetchOrThrow('/api/maintenance');
      dispatch(maintenancesActions.refresh(await response.json()));
    }
  }, [authenticated, settingsAccess]);

  useEffectAsync(async () => {
    if (authenticated && (reportsAccess || settingsAccess)) {
      const response = await fetchOrThrow('/api/calendars');
      dispatch(calendarsActions.refresh(await response.json()));
    }
  }, [authenticated, reportsAccess, settingsAccess]);

  return null;
};

export default connect()(CachingController);

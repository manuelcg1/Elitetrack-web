import { combineReducers, configureStore } from '@reduxjs/toolkit';

import { errorsReducer as errors } from './errors';
import { sessionReducer as session } from './session';
import { devicesReducer as devices } from './devices';
import { eventsReducer as events } from './events';
import { alertEventsReducer as alertEvents } from './alertEvents';
import { motionReducer as motion } from './motion';
import { geofencesReducer as geofences } from './geofences';
import { groupsReducer as groups } from './groups';
import { driversReducer as drivers } from './drivers';
import { maintenancesReducer as maintenances } from './maintenances';
import { calendarsReducer as calendars } from './calendars';
import { gpsInventoryReducer as gpsInventory } from './gpsInventory';
import throttleMiddleware from './throttleMiddleware';

const reducer = combineReducers({
  errors,
  session,
  devices,
  events,
  alertEvents,
  motion,
  geofences,
  groups,
  drivers,
  maintenances,
  calendars,
  gpsInventory,
});

export { errorsActions } from './errors';
export { sessionActions } from './session';
export { devicesActions } from './devices';
export { eventsActions } from './events';
export { alertEventsActions } from './alertEvents';
export { motionActions } from './motion';
export { geofencesActions } from './geofences';
export { groupsActions } from './groups';
export { driversActions } from './drivers';
export { maintenancesActions } from './maintenances';
export { calendarsActions } from './calendars';
export { gpsInventoryActions } from './gpsInventory';

export default configureStore({
  reducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(throttleMiddleware),
});

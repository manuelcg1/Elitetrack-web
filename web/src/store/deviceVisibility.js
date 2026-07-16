import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  byId: {},
  userId: null,
};

const { reducer, actions } = createSlice({
  name: 'deviceVisibility',
  initialState,
  reducers: {
    hydrate(state, action) {
      const { userId, devices = {} } = action.payload;
      state.userId = userId;
      state.byId = Object.fromEntries(
        Object.entries(devices).map(([deviceId, visible]) => [deviceId, visible === true]),
      );
    },
    reconcile(state, action) {
      const { userId, deviceIds } = action.payload;
      if (state.userId !== userId) return;
      const nextById = Object.fromEntries(
        deviceIds.map((deviceId) => [deviceId, state.byId[deviceId] === true]),
      );
      const currentIds = Object.keys(state.byId);
      const changed =
        currentIds.length !== deviceIds.length ||
        deviceIds.some((deviceId) => state.byId[deviceId] !== nextById[deviceId]);
      if (changed) state.byId = nextById;
    },
    toggle(state, action) {
      state.byId[action.payload] = !state.byId[action.payload];
    },
    setAll(state, action) {
      const { deviceIds, visible } = action.payload;
      deviceIds.forEach((deviceId) => {
        state.byId[deviceId] = visible;
      });
    },
    reset() {
      return initialState;
    },
  },
});

export { actions as deviceVisibilityActions };
export { reducer as deviceVisibilityReducer };

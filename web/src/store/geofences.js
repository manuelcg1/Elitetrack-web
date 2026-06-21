import { createSlice } from '@reduxjs/toolkit';

const { reducer, actions } = createSlice({
  name: 'geofences',
  initialState: {
    items: {},
    visibleIds: [],
  },
  reducers: {
    refresh(state, action) {
      state.items = {};
      action.payload.forEach((item) => (state.items[item.id] = item));
    },
    update(state, action) {
      action.payload.forEach((item) => (state.items[item.id] = item));
    },
    setVisible(state, action) {
      const { id, visible } = action.payload;
      if (visible) {
        if (!state.visibleIds.includes(id)) {
          state.visibleIds.push(id);
        }
      } else {
        state.visibleIds = state.visibleIds.filter((item) => item !== id);
      }
    },
    setVisibleMany(state, action) {
      const { ids, visible } = action.payload;
      if (visible) {
        state.visibleIds = [...new Set([...state.visibleIds, ...ids])];
      } else {
        state.visibleIds = state.visibleIds.filter((id) => !ids.includes(id));
      }
    },
    clearVisible(state) {
      state.visibleIds = [];
    },
  },
});

export { actions as geofencesActions };
export { reducer as geofencesReducer };

import { createSlice } from '@reduxjs/toolkit';

/**
 * Slice de Redux para el inventario de GPS.
 * Sigue el mismo patrón que groups.js — items indexados por id para acceso O(1).
 */
const { reducer, actions } = createSlice({
  name: 'gpsInventory',
  initialState: {
    items: {},
  },
  reducers: {
    refresh(state, action) {
      state.items = {};
      action.payload.forEach((item) => {
        state.items[item.id] = item;
      });
    },
    update(state, action) {
      action.payload.forEach((item) => {
        state.items[item.id] = item;
      });
    },
    remove(state, action) {
      delete state.items[action.payload];
    },
  },
});

export { actions as gpsInventoryActions };
export { reducer as gpsInventoryReducer };

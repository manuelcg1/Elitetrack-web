import { createSlice } from '@reduxjs/toolkit';

const { reducer, actions } = createSlice({
  name: 'events',
  initialState: {
    items: [],
  },
  reducers: {
    add(state, action) {
      state.items.unshift(...action.payload);
      state.items.splice(50);
    },
    // Une eventos cargados del servidor con los que ya llegaron por WebSocket,
    // sin duplicar por id y ordenados del más reciente al más antiguo.
    merge(state, action) {
      const byId = new Map();
      [...state.items, ...action.payload].forEach((item) => {
        const key = item.id || `${item.deviceId}-${item.type}-${item.eventTime}`;
        if (!byId.has(key)) byId.set(key, item);
      });
      state.items = [...byId.values()]
        .sort((a, b) => (Date.parse(b.eventTime) || 0) - (Date.parse(a.eventTime) || 0))
        .slice(0, 50);
    },
    delete(state, action) {
      state.items = state.items.filter((item) => item.id !== action.payload.id);
    },
    deleteAll(state) {
      state.items = [];
    },
  },
});

export { actions as eventsActions };
export { reducer as eventsReducer };

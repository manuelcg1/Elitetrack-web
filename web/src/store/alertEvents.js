import { createSlice } from '@reduxjs/toolkit';

const { reducer, actions } = createSlice({
  name: 'alertEvents',
  initialState: {
    items: [],
  },
  reducers: {
    receive(state, action) {
      // Keep only the latest socket batch; report pages own the event history.
      state.items = action.payload;
    },
  },
});

export { actions as alertEventsActions };
export { reducer as alertEventsReducer };

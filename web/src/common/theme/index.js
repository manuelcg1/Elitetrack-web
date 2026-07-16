import { useMemo } from 'react';
import { createTheme } from '@mui/material/styles';
import palette from './palette';
import dimensions from './dimensions';
import components from './components';

export default (server, darkMode, direction) =>
  useMemo(
    () =>
      createTheme({
        typography: {
          fontFamily: 'Inter, Roboto, "Segoe UI", Helvetica, Arial, sans-serif',
          h1: { fontSize: '2rem', fontWeight: 700, lineHeight: 1.2 },
          h2: { fontSize: '1.625rem', fontWeight: 700, lineHeight: 1.25 },
          h3: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.3 },
          h4: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.35 },
          body1: { fontSize: '0.9375rem', fontWeight: 400, lineHeight: 1.6 },
          body2: { fontSize: '0.8125rem', fontWeight: 400, lineHeight: 1.5 },
          subtitle2: { fontSize: '0.8125rem', fontWeight: 500 },
          caption: { fontSize: '0.75rem', fontWeight: 400 },
          button: { fontSize: '0.9375rem', fontWeight: 600, textTransform: 'none' },
        },
        shape: { borderRadius: 12 },
        palette: palette(server, darkMode),
        direction,
        dimensions,
        components,
      }),
    [server, darkMode, direction],
  );

import { makeStyles } from 'tss-react/mui';

export const compactTableRules = (theme) => ({
  '& .MuiTableBody-root .MuiTableCell-root': {
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
    fontSize: '0.75rem',
    lineHeight: 1.45,
  },
  '& .MuiTableHead-root': {
    backgroundColor: theme.palette.mode === 'dark' ? `${theme.palette.primary.main}12` : '#F1F5F9',
    boxShadow: `inset 0 -2px 0 ${theme.palette.primary.main}`,
  },
  '& .MuiTableHead-root .MuiTableCell-root': {
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
    borderBottom: 'none',
    backgroundColor: theme.palette.mode === 'dark' ? `${theme.palette.primary.main}12` : '#F1F5F9',
    boxShadow: `inset 0 -2px 0 ${theme.palette.primary.main}`,
    color: theme.palette.text.primary,
    fontSize: '0.75rem',
    fontWeight: 700,
    lineHeight: 1.35,
    letterSpacing: '0.035em',
  },
});

export default makeStyles()((theme) => ({
  table: compactTableRules(theme),
}));

import { makeStyles } from 'tss-react/mui';
import { alpha } from '@mui/material/styles';
import { compactTableRules } from '../../common/theme/compactTableStyles';

export default makeStyles()((theme) => ({
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  compactTable: compactTableRules(theme),
  containerMap: {
    flexBasis: '40%',
    flexShrink: 0,
  },
  containerMain: {
    overflow: 'auto',
  },
  header: {
    position: 'sticky',
    left: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  columnAction: {
    width: '1%',
    paddingLeft: theme.spacing(1),
    '@media print': {
      display: 'none',
    },
  },
  columnActionContainer: {
    display: 'flex',
  },
  filter: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'nowrap',
    gap: theme.spacing(2),
    padding: theme.spacing(3, 2, 2),
    [theme.breakpoints.down('lg')]: {
      gap: theme.spacing(1.5),
      padding: theme.spacing(2),
    },
    [theme.breakpoints.down('sm')]: {
      flexWrap: 'wrap',
    },
    '@media print': {
      display: 'none !important',
    },
  },
  filterItem: {
    flex: '1 1 180px',
    minWidth: 0,
    [theme.breakpoints.down('lg')]: {
      flexBasis: 160,
    },
    [theme.breakpoints.down('sm')]: {
      flex: '1 1 100%',
    },
  },
  filterDevice: {
    flex: '2 1 280px',
    minWidth: 0,
    [theme.breakpoints.down('lg')]: {
      flex: '1.8 1 220px',
      minWidth: 0,
    },
    [theme.breakpoints.down('sm')]: {
      flex: '1 1 100%',
      maxWidth: 'none',
      minWidth: 0,
    },
  },
  filterGroup: {
    flex: '1.1 1 180px',
    minWidth: 0,
    [theme.breakpoints.down('lg')]: {
      flex: '1 1 160px',
    },
    [theme.breakpoints.down('sm')]: {
      flex: '1 1 100%',
    },
  },
  filterPeriod: {
    flex: '0.85 1 160px',
    minWidth: 0,
    [theme.breakpoints.down('lg')]: {
      flex: '0.9 1 150px',
    },
    [theme.breakpoints.down('sm')]: {
      flex: '1 1 100%',
    },
  },
  filterDate: {
    flex: '1.25 1 220px',
    minWidth: 0,
    [theme.breakpoints.down('lg')]: {
      flexBasis: 200,
    },
    [theme.breakpoints.down('sm')]: {
      flex: '1 1 100%',
    },
  },
  filterEvent: {
    flex: '1.25 1 220px',
    minWidth: 0,
    [theme.breakpoints.down('lg')]: {
      flexBasis: 200,
    },
    [theme.breakpoints.down('sm')]: {
      flex: '1 1 100%',
    },
  },
  filterGeofence: {
    flex: '1 1 180px',
    minWidth: 0,
    [theme.breakpoints.down('lg')]: {
      flexBasis: 160,
    },
    [theme.breakpoints.down('sm')]: {
      flex: '1 1 100%',
    },
  },
  filterColumns: {
    flex: '1.15 1 200px',
    minWidth: 0,
    overflow: 'hidden',
    '& .MuiFormControl-root': {
      minWidth: 0,
    },
    '& .MuiSelect-select': {
      display: 'block',
      minWidth: '0 !important',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    [theme.breakpoints.down('lg')]: {
      flexBasis: 180,
    },
    [theme.breakpoints.down('sm')]: {
      flex: '1 1 100%',
    },
  },
  filterButtons: {
    display: 'flex',
    gap: theme.spacing(1),
    flex: '1 1 160px',
    minWidth: 0,
    [theme.breakpoints.down('lg')]: {
      flexBasis: 150,
      marginLeft: 0,
    },
    [theme.breakpoints.down('sm')]: {
      flex: '1 1 100%',
    },
  },
  filterButton: {
    flexGrow: 1,
  },
  filterAction: {
    flex: '1.5 1 220px',
    minWidth: 0,
    '& .MuiButton-root.MuiButton-outlined': {
      color:
        theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.dark,
      backgroundColor: alpha(
        theme.palette.primary.main,
        theme.palette.mode === 'dark' ? 0.14 : 0.1,
      ),
      borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.7 : 0.48),
      '&:hover': {
        backgroundColor: alpha(
          theme.palette.primary.main,
          theme.palette.mode === 'dark' ? 0.22 : 0.16,
        ),
        borderColor: theme.palette.primary.dark,
      },
      '&.Mui-disabled': {
        color: theme.palette.text.disabled,
        backgroundColor: theme.palette.action.disabledBackground,
        borderColor: alpha(theme.palette.text.disabled, 0.4),
      },
    },
    [theme.breakpoints.down('lg')]: {
      flex: '1 1 170px',
    },
    [theme.breakpoints.down('sm')]: {
      flex: '1 1 100%',
      marginLeft: 0,
    },
  },
  chart: {
    flexGrow: 1,
    overflow: 'hidden',
  },
  actionCellPadding: {
    '&.MuiTableCell-body': {
      paddingTop: 0,
      paddingBottom: 0,
    },
    '@media print': {
      display: 'none',
    },
  },
}));

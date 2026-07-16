import { makeStyles } from 'tss-react/mui';
import { compactTableRules } from '../../common/theme/compactTableStyles';

export default makeStyles()((theme) => ({
  table: {
    marginBottom: theme.spacing(10),
    ...compactTableRules(theme),
  },
  columnAction: {
    width: '1%',
    paddingRight: theme.spacing(1),
  },
  container: {
    marginTop: theme.spacing(2),
  },
  buttons: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    display: 'flex',
    justifyContent: 'space-evenly',
    '& > *': {
      flexBasis: '33%',
    },
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingBottom: theme.spacing(3),
  },
  verticalActions: {
    display: 'flex',
    flexDirection: 'column',
  },
}));

import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { useTranslation } from '../../common/components/LocalizationProvider';
import useReportStyles from '../common/useReportStyles';

const ColumnSelect = ({ columns, setColumns, columnsArray, rawValues, disabled }) => {
  const { classes } = useReportStyles();
  const t = useTranslation();

  return (
    <div className={classes.filterColumns}>
      <FormControl fullWidth size="small">
        <InputLabel>{t('sharedColumns')}</InputLabel>
        <Select
          size="small"
          label={t('sharedColumns')}
          value={columns}
          onChange={(e) => setColumns(e.target.value)}
          multiple
          disabled={disabled}
        >
          {columnsArray.map(([key, string]) => (
            <MenuItem key={key} value={key}>
              {rawValues ? string : t(string)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
};

export default ColumnSelect;

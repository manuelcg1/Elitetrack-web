import { useEffect, useState } from 'react';
import { Autocomplete, TextField, Chip, Tooltip } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useEffectAsync } from '../../reactHelper';
import fetchOrThrow from '../util/fetchOrThrow';

const useStyles = makeStyles()(() => ({
  autocompleteMultiple: {
    '& .MuiAutocomplete-inputRoot': {
      flexWrap: 'nowrap',
      overflow: 'hidden',
    },
    '& .MuiAutocomplete-input': {
      minWidth: '1px !important',
    },
    '& .MuiAutocomplete-tag .MuiChip-label': {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  },
}));

const SelectField = ({
  label,
  fullWidth,
  multiple,
  value = null,
  emptyValue = null,
  emptyTitle = '',
  onChange,
  endpoint,
  data,
  keyGetter = (item) => item.id,
  titleGetter = (item) => item.name,
  helperText,
  placeholder,
  singleLine,
}) => {
  const { classes } = useStyles();
  const [items, setItems] = useState();

  const findOption = (option) => {
    if (typeof option === 'object') {
      return option;
    }
    return items.find((obj) => keyGetter(obj) === option);
  };

  const getOptionLabel = (option) => {
    option = findOption(option);
    return option ? titleGetter(option) : emptyTitle;
  };

  useEffect(() => setItems(data), [data]);

  useEffectAsync(async () => {
    if (endpoint) {
      const response = await fetchOrThrow(endpoint);
      setItems(await response.json());
    }
  }, []);

  if (items) {
    const autocompleteValue = multiple
      ? (value || []).map((it) => findOption(it)).filter((it) => it != null)
      : findOption(value) || null;

    return (
      <Autocomplete
        size={singleLine ? 'small' : 'medium'}
        multiple={multiple}
        className={multiple && singleLine ? classes.autocompleteMultiple : undefined}
        options={items}
        getOptionLabel={getOptionLabel}
        renderOption={({ key, ...props }, option) => (
          <li key={keyGetter(option) || key} {...props}>
            {titleGetter(option)}
          </li>
        )}
        isOptionEqualToValue={(option, selectedOption) =>
          keyGetter(option) === keyGetter(selectedOption)
        }
        value={autocompleteValue}
        onChange={(_, selectedValue) => {
          if (multiple) {
            onChange({ target: { value: selectedValue.map((item) => keyGetter(item)) } });
          } else {
            onChange({ target: { value: selectedValue ? keyGetter(selectedValue) : emptyValue } });
          }
        }}
        renderValue={
          multiple && singleLine
            ? (tagValue, getItemProps) => {
                if (!tagValue.length) {
                  return null;
                }
                const visibleTags = tagValue.slice(0, 2);
                const remainingTags = tagValue.slice(2);
                return (
                  <>
                    {visibleTags.map((item, index) => (
                      <Tooltip key={keyGetter(item)} title={titleGetter(item)}>
                        <Chip
                          {...getItemProps({ index })}
                          label={titleGetter(item)}
                          size="small"
                          sx={{ minWidth: 0 }}
                        />
                      </Tooltip>
                    ))}
                    {remainingTags.length > 0 && (
                      <Tooltip title={remainingTags.map(titleGetter).join(', ')}>
                        <Chip
                          label={`+${remainingTags.length}`}
                          size="small"
                          sx={{ flexShrink: 0 }}
                        />
                      </Tooltip>
                    )}
                  </>
                );
              }
            : undefined
        }
        fullWidth={fullWidth}
        disableCloseOnSelect={multiple}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            helperText={helperText}
            placeholder={multiple && !autocompleteValue.length ? placeholder : undefined}
            slotProps={{
              ...params.slotProps,
              inputLabel: {
                ...params.slotProps?.inputLabel,
                shrink:
                  (multiple && !autocompleteValue.length && Boolean(placeholder)) ||
                  params.slotProps?.inputLabel?.shrink,
              },
            }}
          />
        )}
      />
    );
  }
  return null;
};

export default SelectField;

import { Autocomplete, Snackbar, TextField } from '@mui/material';
import { useRef, useState } from 'react';
import { useCatchCallback, useEffectAsync } from '../../reactHelper';
import { snackBarDurationShortMs } from '../util/duration';
import { useTranslation } from './LocalizationProvider';
import fetchOrThrow from '../util/fetchOrThrow';
import savePermissionChanges from '../util/savePermissionChanges';

const LinkField = ({
  label,
  endpointAll,
  endpointLinked,
  baseId,
  keyBase,
  keyLink,
  keyGetter = (item) => item.id,
  titleGetter = (item) => item.name,
}) => {
  const t = useTranslation();
  const [active, setActive] = useState(false);
  const [items, setItems] = useState();
  const [linked, setLinked] = useState();
  const [updated, setUpdated] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [savedWithWarning, setSavedWithWarning] = useState(false);

  useEffectAsync(async () => {
    if (active) {
      const response = await fetchOrThrow(endpointAll);
      setItems(await response.json());
    }
  }, [active]);

  useEffectAsync(async () => {
    if (active) {
      const response = await fetchOrThrow(endpointLinked);
      setLinked(await response.json());
    }
  }, [active]);

  const onChange = useCatchCallback(
    async (value) => {
      if (savingRef.current || !linked) {
        return;
      }
      const oldValue = linked.map((it) => keyGetter(it));
      const newValue = value.map((it) => keyGetter(it));
      if (!newValue.find((it) => it < 0)) {
        savingRef.current = true;
        setSaving(true);
        try {
          const response = await savePermissionChanges({
            previous: oldValue,
            next: newValue,
            baseId,
            keyBase,
            keyLink,
          });
          setSavedWithWarning(
            response?.headers.get('X-Permission-Refresh') === 'pending' ||
              response?.headers.get('X-Permission-Audit') === 'pending',
          );
          setUpdated(Boolean(response));
          setLinked(value);
        } catch (error) {
          // A lost response can happen after commit. Reload the authoritative list before retrying.
          setActive(false);
          setItems(undefined);
          setLinked(undefined);
          throw error;
        } finally {
          savingRef.current = false;
          setSaving(false);
        }
      }
    },
    [linked, baseId, keyBase, keyLink, keyGetter],
  );

  return (
    <>
      <Autocomplete
        size="small"
        loading={saving || (active && (!items || !linked))}
        disabled={saving}
        isOptionEqualToValue={(i1, i2) => keyGetter(i1) === keyGetter(i2)}
        options={items || []}
        getOptionLabel={(item) => titleGetter(item)}
        slotProps={{ chip: { size: 'small' } }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder={!active ? t('reportShow') : null}
            onFocus={() => setActive(true)}
            slotProps={{
              ...params.slotProps,
              inputLabel: {
                ...params.slotProps?.inputLabel,
                shrink: !active || params.slotProps?.inputLabel?.shrink,
              },
            }}
          />
        )}
        value={(items && linked) || []}
        onChange={(_, value) => onChange(value)}
        multiple
      />
      <Snackbar
        open={Boolean(updated)}
        onClose={() => setUpdated(false)}
        autoHideDuration={snackBarDurationShortMs}
        message={t(savedWithWarning ? 'sharedSavedWithWarning' : 'sharedSaved')}
      />
    </>
  );
};

export default LinkField;

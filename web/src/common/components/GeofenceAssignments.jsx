import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useAdministrator, useRestriction } from '../util/permissions';
import { useTranslation } from './LocalizationProvider';
import fetchOrThrow from '../util/fetchOrThrow';
import {
  assignmentBatch,
  assignmentRows,
  visibleAssignmentRows,
} from '../util/geofenceAssignments';

const GeofenceAssignments = ({ userId }) => {
  const t = useTranslation();
  const admin = useAdministrator();
  const readonly = useRestriction('readonly');
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  const [reload, setReload] = useState(0);
  const savingRef = useRef(false);
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setData(null);
    setDraft(null);
    setError('');
    Promise.all(
      [
        '/api/geofenceFolders?all=true',
        '/api/geofences?all=true',
        `/api/geofenceFolders?userId=${userId}`,
        `/api/geofences?userId=${userId}`,
      ].map(async (url) => (await fetchOrThrow(url)).json()),
    )
      .then(([folders, geofences, linkedFolders, linkedGeofences]) => {
        if (!active) return;
        const original = {
          folders: linkedFolders.map((v) => v.id),
          geofences: linkedGeofences.map((v) => v.id),
        };
        setData({ folders, geofences, original });
        setDraft(original);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [open, userId, reload]);
  const rows = useMemo(
    () =>
      data && draft
        ? assignmentRows(data.folders, data.geofences, draft.folders, draft.geofences)
        : [],
    [data, draft],
  );
  const batch =
    data && draft ? assignmentBatch(userId, data.original, draft) : { additions: [], removals: [] };
  const changed = batch.additions.length + batch.removals.length > 0;
  const visibleRows = useMemo(
    () => visibleAssignmentRows(rows, expanded, search),
    [rows, expanded, search],
  );
  const toggleFolder = (id) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggle = (row) => {
    const key = row.kind === 'folder' ? 'folders' : 'geofences';
    setDraft((previous) => ({
      ...previous,
      [key]: row.direct ? previous[key].filter((id) => id !== row.id) : [...previous[key], row.id],
    }));
  };
  const save = async () => {
    if (savingRef.current || readonly || !changed) return;
    savingRef.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await fetchOrThrow('/api/permissions/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      const pending = ['X-Permission-Refresh', 'X-Permission-Audit'].some(
        (key) => response.headers.get(key) === 'pending',
      );
      setNotice(t(pending ? 'sharedSavedWithWarning' : 'sharedSaved'));
      setOpen(false);
    } catch (e) {
      // The commit may have succeeded even if its response was lost. Require a fresh read.
      setData(null);
      setDraft(null);
      setError(e.message);
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        variant="outlined"
        onClick={() => {
          setNotice('');
          setSearch('');
          setExpanded(new Set());
          setOpen(true);
        }}
      >
        {t('geofenceAssignments')}
      </Button>
      {notice && <Alert severity="info">{notice}</Alert>}
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t('geofenceAssignments')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('geofenceAssignmentHelp')}
          </Typography>
          {!admin && <Alert severity="info">{t('geofenceAssignmentPartial')}</Alert>}
          {readonly && <Alert severity="info">{t('serverReadonly')}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          {!data && !error && <Typography role="status">{t('sharedLoading')}</Typography>}
          {!data && error && (
            <Button onClick={() => setReload((v) => v + 1)}>{t('geofenceRetry')}</Button>
          )}
          {data && (
            <>
              <TextField
                fullWidth
                size="small"
                label={t('sharedSearch')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ my: 2 }}
              />
              <Box sx={{ maxHeight: 420, overflow: 'auto' }}>
                {visibleRows.map((row) => (
                  <Stack
                    key={row.key}
                    direction="row"
                    sx={{ alignItems: 'center', pl: Math.min(row.depth, 8) * 2 }}
                  >
                    {row.kind === 'folder' ? (
                      <IconButton
                        size="small"
                        aria-label={`${t(expanded.has(row.id) ? 'geofenceCollapseFolder' : 'geofenceExpandFolder')}: ${row.name || row.id}`}
                        aria-expanded={expanded.has(row.id)}
                        onClick={() => toggleFolder(row.id)}
                      >
                        {expanded.has(row.id) ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                      </IconButton>
                    ) : (
                      <Box sx={{ width: 30, flexShrink: 0 }} />
                    )}
                    <FormControlLabel
                      sx={{ flex: 1 }}
                      control={
                        <Checkbox
                          checked={row.direct}
                          indeterminate={row.inherited && !row.direct}
                          slotProps={{
                            input: {
                              'aria-checked': row.inherited && !row.direct ? 'mixed' : row.direct,
                            },
                          }}
                          disabled={busy || readonly || (row.invalid && !row.direct)}
                          onChange={() => toggle(row)}
                        />
                      }
                      label={row.name || row.id}
                    />
                    {row.invalid && (
                      <Chip size="small" color="warning" label={t('geofenceInvalidBranch')} />
                    )}
                  </Stack>
                ))}
                {!visibleRows.length && <Typography>{t('sharedNoData')}</Typography>}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setOpen(false)}>
            {t('sharedCancel')}
          </Button>
          <Button
            variant="contained"
            disabled={busy || readonly || !data || !changed}
            onClick={save}
          >
            {t('sharedSave')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default GeofenceAssignments;

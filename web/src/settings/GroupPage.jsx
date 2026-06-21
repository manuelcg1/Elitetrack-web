import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditItemView from './components/EditItemView';
import EditAttributesAccordion from './components/EditAttributesAccordion';
import SelectField from '../common/components/SelectField';
import { useTranslation } from '../common/components/LocalizationProvider';
import SettingsMenu from './components/SettingsMenu';
import useCommonDeviceAttributes from '../common/attributes/useCommonDeviceAttributes';
import useGroupAttributes from '../common/attributes/useGroupAttributes';
import { useCatch } from '../reactHelper';
import { groupsActions } from '../store';
import useSettingsStyles from './common/useSettingsStyles';
import fetchOrThrow from '../common/util/fetchOrThrow';

/**
 * GroupPage — Formulario crear/editar grupo.
 * Ruta: src/settings/GroupPage.jsx
 *
 * Acepta ?parentId=<id> para pre-asignar el grupo padre
 * cuando se crea un subgrupo desde el árbol en GroupsPage.
 */
const GroupPage = () => {
  const { classes } = useSettingsStyles();
  const dispatch = useDispatch();
  const t = useTranslation();

  const [searchParams] = useSearchParams();
  const parentIdFromQuery = searchParams.get('parentId')
    ? Number(searchParams.get('parentId'))
    : null;

  const commonDeviceAttributes = useCommonDeviceAttributes(t);
  const groupAttributes = useGroupAttributes(t);

  const [item, setItem] = useState();

  // Pre-asignar grupo padre si viene de la URL
  useEffect(() => {
    if (item && parentIdFromQuery && !item.groupId) {
      setItem((prev) => ({ ...prev, groupId: parentIdFromQuery }));
    }
  }, [item, parentIdFromQuery]);

  const onItemSaved = useCatch(async () => {
    const response = await fetchOrThrow('/api/groups');
    dispatch(groupsActions.refresh(await response.json()));
  });

  const validate = () => item && item.name;

  return (
    <EditItemView
      endpoint="groups"
      item={item}
      setItem={setItem}
      validate={validate}
      onItemSaved={onItemSaved}
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'groupDialog']}
    >
      {item && (
        <>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">{t('sharedRequired')}</Typography>
            </AccordionSummary>
            <AccordionDetails className={classes.details}>
              <TextField
                value={item.name || ''}
                onChange={(e) => setItem({ ...item, name: e.target.value })}
                label={t('sharedName')}
                fullWidth
                autoFocus
              />
            </AccordionDetails>
          </Accordion>

          <Accordion defaultExpanded={Boolean(parentIdFromQuery)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">{t('sharedExtra')}</Typography>
            </AccordionSummary>
            <AccordionDetails className={classes.details}>
              <SelectField
                value={item.groupId || ''}
                onChange={(e) =>
                  setItem({ ...item, groupId: Number(e.target.value) || null })
                }
                endpoint="/api/groups"
                label={t('groupParent')}
              />
            </AccordionDetails>
          </Accordion>

          <EditAttributesAccordion
            attributes={item.attributes}
            setAttributes={(attributes) => setItem({ ...item, attributes })}
            definitions={{ ...commonDeviceAttributes, ...groupAttributes }}
          />
        </>
      )}
    </EditItemView>
  );
};

export default GroupPage;

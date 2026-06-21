import { useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { gpsInventoryActions } from '../../store';
import { useEffectAsync, useCatch } from '../../reactHelper';
import fetchOrThrow from '../../common/util/fetchOrThrow';

/**
 * useGpsInventory — Hook de datos para el inventario GPS.
 * Ubicación: src/monitoring/gps-inventory/useGpsInventory.js
 */
const useGpsInventory = () => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchOrThrow('/api/gps-inventory');
      const data = await response.json();
      dispatch(gpsInventoryActions.refresh(data));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffectAsync(async () => {
    await loadInventory();
  }, [loadInventory]);

  const createGps = useCatch(async (gpsData) => {
    const response = await fetchOrThrow('/api/gps-inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gpsData),
    });
    const created = await response.json();
    dispatch(gpsInventoryActions.update([created]));
    return created;
  });

  const updateGps = useCatch(async (gpsData) => {
    const response = await fetchOrThrow(`/api/gps-inventory/${gpsData.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gpsData),
    });
    const updated = await response.json();
    dispatch(gpsInventoryActions.update([updated]));
    return updated;
  });

  const deleteGps = useCatch(async (id) => {
    await fetchOrThrow(`/api/gps-inventory/${id}`, { method: 'DELETE' });
    dispatch(gpsInventoryActions.remove(id));
  });

  return {
    loading,
    error,
    loadInventory,
    createGps,
    updateGps,
    deleteGps,
  };
};

export default useGpsInventory;

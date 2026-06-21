import { useMemo } from 'react';
import useGroupTree from './useGroupTree';

/**
 * Dado un groupId, retorna el conjunto de IDs de ese grupo
 * y todos sus descendientes (subgrupos a cualquier profundidad).
 *
 * Útil para filtrar dispositivos por grupo en el mapa:
 * si seleccionas "Flota Lima", también ves los dispositivos
 * de "Flota Lima > Zona Norte" y "Flota Lima > Zona Norte > Turno Mañana".
 *
 * @param {number|null} groupId - ID del grupo raíz a expandir
 * @returns {Set<number>} conjunto de IDs del grupo y sus descendientes
 */
const useGroupDescendants = (groupId) => {
  const { flatMap } = useGroupTree();

  return useMemo(() => {
    if (!groupId) return new Set();

    const result = new Set();

    const collect = (id) => {
      if (!id || result.has(id)) return;
      result.add(id);
      const node = flatMap[id];
      if (node) {
        node.children.forEach((child) => collect(child.id));
      }
    };

    collect(groupId);
    return result;
  }, [groupId, flatMap]);
};

export default useGroupDescendants;

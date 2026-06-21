import { useMemo } from 'react';
import { useSelector } from 'react-redux';

/**
 * Construye un árbol de grupos desde el store de Redux.
 *
 * Cada nodo tiene la forma:
 * {
 *   ...group,           // propiedades originales del grupo (id, name, groupId, attributes)
 *   children: [...],   // subgrupos hijos directos
 *   depth: number,     // nivel de profundidad (0 = raíz)
 * }
 *
 * @returns {Object} { tree, flatMap }
 *   - tree: array de nodos raíz con sus hijos anidados
 *   - flatMap: mapa id → nodo para acceso directo O(1)
 */
const useGroupTree = () => {
  const groupItems = useSelector((state) => state.groups.items);

  const { tree, flatMap } = useMemo(() => {
    const groups = Object.values(groupItems);

    // Paso 1 — construir mapa id → nodo con children vacíos
    const nodeMap = {};
    groups.forEach((group) => {
      nodeMap[group.id] = { ...group, children: [], depth: 0 };
    });

    // Paso 2 — enlazar hijos con padres y calcular profundidad
    const roots = [];
    groups.forEach((group) => {
      const node = nodeMap[group.id];
      if (group.groupId && nodeMap[group.groupId]) {
        // Es hijo — agregar al padre
        const parent = nodeMap[group.groupId];
        node.depth = parent.depth + 1;
        parent.children.push(node);
      } else {
        // Es raíz — sin padre válido
        roots.push(node);
      }
    });

    // Paso 3 — ordenar alfabéticamente en cada nivel
    const sortNodes = (nodes) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach((node) => sortNodes(node.children));
    };
    sortNodes(roots);

    return { tree: roots, flatMap: nodeMap };
  }, [groupItems]);

  return { tree, flatMap };
};

export default useGroupTree;

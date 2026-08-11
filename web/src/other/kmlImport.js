const elementChildren = (node, name) =>
  Array.from(node.children || []).filter((child) => !name || child.localName === name);

const firstChild = (node, name) => elementChildren(node, name)[0];

const textValue = (node, name) => firstChild(node, name)?.textContent?.trim() || '';

const cleanDescription = (value = '') =>
  value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();

const MAX_NAME_LENGTH = 128;
const MAX_DESCRIPTION_LENGTH = 128;
const MAX_FOLDER_DESCRIPTION_LENGTH = 4000;
const MAX_AREA_LENGTH = 4096;

const limited = (value, maximum) => value.slice(0, maximum);

const parseCoordinates = (value) =>
  value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((tuple) => {
      const [longitude, latitude] = tuple.split(',').map(Number);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('La geometría contiene coordenadas inválidas.');
      }
      return [latitude, longitude];
    });

const parseDms = (value) => {
  if (!value) return null;
  const normalized = value.replace(',', '.').toUpperCase();
  const numbers = normalized.match(/\d+(?:\.\d+)?/g)?.map(Number);
  if (!numbers?.length) return null;
  const [degrees, minutes = 0, seconds = 0] = numbers;
  if (minutes >= 60 || seconds >= 60) return null;
  let result = degrees + minutes / 60 + seconds / 3600;
  const direction = normalized.match(/[NSEOW]\s*$/)?.[0]?.trim();
  if (['S', 'O', 'W'].includes(direction)) result *= -1;
  return result;
};

const descriptionCoordinate = (description, label) => {
  const line = description
    .split('\n')
    .find((item) => item.trim().toUpperCase().startsWith(`${label}:`));
  return parseDms(line?.slice(line.indexOf(':') + 1).trim());
};

const kmlColor = (value) => {
  const color = value?.trim();
  if (!/^[0-9a-fA-F]{8}$/.test(color || '')) return null;
  return `#${color.slice(6, 8)}${color.slice(4, 6)}${color.slice(2, 4)}`;
};

const buildStyleMap = (documentNode) => {
  const styles = new Map();
  const aliases = new Map();

  Array.from(documentNode.getElementsByTagNameNS('*', 'Style')).forEach((style) => {
    if (!style.id) return;
    const lineColor = kmlColor(
      firstChild(firstChild(style, 'LineStyle') || {}, 'color')?.textContent,
    );
    const polygonColor = kmlColor(
      firstChild(firstChild(style, 'PolyStyle') || {}, 'color')?.textContent,
    );
    const iconColor = kmlColor(
      firstChild(firstChild(style, 'IconStyle') || {}, 'color')?.textContent,
    );
    styles.set(style.id, polygonColor || lineColor || iconColor);
  });

  Array.from(documentNode.getElementsByTagNameNS('*', 'StyleMap')).forEach((styleMap) => {
    const normalPair = elementChildren(styleMap, 'Pair').find(
      (pair) => textValue(pair, 'key') === 'normal',
    );
    const target = textValue(normalPair || {}, 'styleUrl').replace(/^#/, '');
    if (styleMap.id && target) aliases.set(styleMap.id, target);
  });

  return (styleUrl) => {
    let id = (styleUrl || '').replace(/^#/, '');
    id = aliases.get(id) || id;
    return styles.get(id) || null;
  };
};

const extendedValue = (placemark, key) => {
  const data = Array.from(placemark.getElementsByTagNameNS('*', 'Data')).find(
    (item) => item.getAttribute('name')?.toUpperCase() === key,
  );
  return data ? textValue(data, 'value') : '';
};

const geometryItems = (placemark) => {
  const direct = elementChildren(placemark).filter((child) =>
    ['Point', 'LineString', 'Polygon', 'MultiGeometry'].includes(child.localName),
  );
  return direct.flatMap((geometry) =>
    geometry.localName === 'MultiGeometry'
      ? elementChildren(geometry).filter((child) =>
          ['Point', 'LineString', 'Polygon'].includes(child.localName),
        )
      : [geometry],
  );
};

const geometryToArea = (geometry) => {
  const coordinatesNode = geometry.getElementsByTagNameNS('*', 'coordinates')[0];
  if (!coordinatesNode) throw new Error('La geometría no contiene coordenadas.');
  const coordinates = parseCoordinates(coordinatesNode.textContent);

  if (geometry.localName === 'Point') {
    if (coordinates.length !== 1) throw new Error('El punto no es válido.');
    return `CIRCLE (${coordinates[0][0]} ${coordinates[0][1]}, 25)`;
  }
  if (geometry.localName === 'LineString') {
    if (coordinates.length < 2) throw new Error('La línea necesita al menos dos puntos.');
    return `LINESTRING (${coordinates.map((item) => item.join(' ')).join(', ')})`;
  }
  if (coordinates.length < 3) throw new Error('El polígono necesita al menos tres puntos.');
  const closed =
    coordinates[0][0] === coordinates.at(-1)[0] && coordinates[0][1] === coordinates.at(-1)[1]
      ? coordinates
      : [...coordinates, coordinates[0]];
  return `POLYGON ((${closed.map((item) => item.join(' ')).join(', ')}))`;
};

export const parseKml = (content) => {
  const xml = new DOMParser().parseFromString(content, 'text/xml');
  if (xml.querySelector('parsererror')) throw new Error('El archivo KML no contiene XML válido.');
  const documentNode = xml.getElementsByTagNameNS('*', 'Document')[0];
  if (!documentNode) throw new Error('El archivo no contiene un documento KML.');

  const resolveColor = buildStyleMap(documentNode);
  const folders = [];
  const geofences = [];
  const omitted = [];
  let sequence = 0;

  const addPlacemark = (placemark, folderKey) => {
    const name = limited(
      textValue(placemark, 'name') || `Geo-zona ${geofences.length + 1}`,
      MAX_NAME_LENGTH,
    );
    const fullDescription = cleanDescription(textValue(placemark, 'description'));
    const description = limited(fullDescription, MAX_DESCRIPTION_LENGTH);
    const color = resolveColor(textValue(placemark, 'styleUrl'));
    const geometries = geometryItems(placemark);

    if (!geometries.length) {
      const latitude =
        parseDms(extendedValue(placemark, 'LATITUD')) ??
        descriptionCoordinate(fullDescription, 'LATITUD');
      const longitude =
        parseDms(extendedValue(placemark, 'LONGITUD')) ??
        descriptionCoordinate(fullDescription, 'LONGITUD');
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        geofences.push({
          name,
          description,
          fullDescription,
          folderKey,
          area: `CIRCLE (${latitude} ${longitude}, 25)`,
          color,
          recovered: true,
          type: 'Point',
        });
      } else {
        omitted.push({ name, reason: 'No contiene una geometría compatible.' });
      }
      return;
    }

    geometries.forEach((geometry, index) => {
      try {
        const area = geometryToArea(geometry);
        const suffix = geometries.length > 1 ? ` ${index + 1}` : '';
        if (area.length > MAX_AREA_LENGTH) {
          throw new Error('La geometría supera el límite de 4096 caracteres.');
        }
        geofences.push({
          name: `${limited(name, MAX_NAME_LENGTH - suffix.length)}${suffix}`,
          description,
          fullDescription,
          folderKey,
          area,
          color,
          recovered: false,
          type: geometry.localName,
        });
      } catch (error) {
        omitted.push({ name, reason: error.message });
      }
    });
  };

  const visitContainer = (container, parentKey = null) => {
    elementChildren(container).forEach((child) => {
      if (child.localName === 'Folder') {
        const key = `folder-${sequence++}`;
        folders.push({
          key,
          parentKey,
          name: limited(
            textValue(child, 'name') || `Carpeta ${folders.length + 1}`,
            MAX_NAME_LENGTH,
          ),
          description: limited(
            cleanDescription(textValue(child, 'description')),
            MAX_FOLDER_DESCRIPTION_LENGTH,
          ),
        });
        visitContainer(child, key);
      } else if (child.localName === 'Placemark') {
        addPlacemark(child, parentKey);
      }
    });
  };

  visitContainer(documentNode);
  if (!folders.length && !geofences.length) {
    throw new Error('El archivo KML no contiene carpetas ni geometrías compatibles.');
  }
  return {
    name: textValue(documentNode, 'name') || 'Importación KML',
    folders,
    geofences,
    omitted,
  };
};

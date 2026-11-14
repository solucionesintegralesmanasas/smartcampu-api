const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Sustituye las variables `{{ nombre }}` de un texto. Las variables sin valor se reemplazan por cadena vacía.
 * @param {string|null|undefined} text - Texto de la plantilla.
 * @param {Object<string, *>} [variables] - Valores a interpolar.
 * @returns {string|null} Texto renderizado, o null si no hay texto.
 */
const renderTemplate = (text, variables = {}) => {
  if (typeof text !== 'string') return null;
  return text.replace(PLACEHOLDER, (_match, name) => {
    const value = variables[name];
    return value === undefined || value === null ? '' : String(value);
  });
};

/**
 * Lista los nombres de variables que referencia un texto, sin repetidos.
 * @param {string|null|undefined} text
 * @returns {string[]}
 */
const extractTemplateVariables = (text) => {
  if (typeof text !== 'string') return [];
  const names = [...text.matchAll(PLACEHOLDER)].map((match) => match[1]);
  return [...new Set(names)];
};

module.exports = { renderTemplate, extractTemplateVariables };

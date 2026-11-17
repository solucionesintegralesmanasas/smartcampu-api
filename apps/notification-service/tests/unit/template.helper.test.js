const { renderTemplate, extractTemplateVariables } = require('../../src/core/helpers/template.helper');

describe('template.helper', () => {
  it('sustituye variables delimitadas por dobles llaves', () => {
    const texto = renderTemplate('Hola {{ nombre }}, tu trámite {{ codigo }} está listo', {
      nombre: 'Ana',
      codigo: 'REQ-1',
    });
    expect(texto).toBe('Hola Ana, tu trámite REQ-1 está listo');
  });

  it('reemplaza por cadena vacía las variables sin valor', () => {
    expect(renderTemplate('Estado: {{ estado }}', {})).toBe('Estado: ');
  });

  it('devuelve null si el texto no es string', () => {
    expect(renderTemplate(null, {})).toBeNull();
  });

  it('extrae las variables sin repetidos', () => {
    expect(extractTemplateVariables('{{ a }} {{ b }} {{ a }}')).toEqual(['a', 'b']);
  });
});

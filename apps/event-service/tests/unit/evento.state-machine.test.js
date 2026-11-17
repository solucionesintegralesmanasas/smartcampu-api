const {
  ESTADOS_EVENTO,
  puedeTransicionar,
  validarTransicion,
  esEstadoPublico,
  puedeEditarse,
  validarEdicion,
  validarEliminacion,
  siguientesEstados,
} = require('../../src/modules/evento/evento.state-machine');
const { ConflictError } = require('../../src/core/exceptions');

describe('evento.state-machine', () => {
  it('permite el flujo principal del evento', () => {
    expect(puedeTransicionar(ESTADOS_EVENTO.DRAFT, ESTADOS_EVENTO.PUBLISHED)).toBe(true);
    expect(puedeTransicionar(ESTADOS_EVENTO.PUBLISHED, ESTADOS_EVENTO.ONGOING)).toBe(true);
    expect(puedeTransicionar(ESTADOS_EVENTO.PUBLISHED, ESTADOS_EVENTO.CANCELLED)).toBe(true);
    expect(puedeTransicionar(ESTADOS_EVENTO.ONGOING, ESTADOS_EVENTO.COMPLETED)).toBe(true);
  });

  it('rechaza transiciones inválidas y estados terminales', () => {
    expect(puedeTransicionar(ESTADOS_EVENTO.DRAFT, ESTADOS_EVENTO.COMPLETED)).toBe(false);
    expect(siguientesEstados(ESTADOS_EVENTO.COMPLETED)).toEqual([]);
    expect(siguientesEstados(ESTADOS_EVENTO.CANCELLED)).toEqual([]);
    expect(() => validarTransicion(ESTADOS_EVENTO.CANCELLED, ESTADOS_EVENTO.PUBLISHED)).toThrow(
      ConflictError,
    );
  });

  it('define los estados públicos', () => {
    expect(esEstadoPublico(ESTADOS_EVENTO.PUBLISHED)).toBe(true);
    expect(esEstadoPublico(ESTADOS_EVENTO.ONGOING)).toBe(true);
    expect(esEstadoPublico(ESTADOS_EVENTO.DRAFT)).toBe(false);
  });

  it('el borrador y el publicado sin inscritos son editables', () => {
    expect(puedeEditarse(ESTADOS_EVENTO.DRAFT, false)).toBe(true);
    expect(puedeEditarse(ESTADOS_EVENTO.PUBLISHED, false)).toBe(true);
    expect(puedeEditarse(ESTADOS_EVENTO.PUBLISHED, true)).toBe(false);
    expect(() => validarEdicion(ESTADOS_EVENTO.PUBLISHED, true)).toThrow(ConflictError);
  });

  it('solo se eliminan eventos en borrador', () => {
    expect(() => validarEliminacion(ESTADOS_EVENTO.DRAFT)).not.toThrow();
    expect(() => validarEliminacion(ESTADOS_EVENTO.PUBLISHED)).toThrow(ConflictError);
  });
});

const {
  ESTADOS,
  puedeTransicionar,
  transicionesPermitidas,
  validarTransicion,
} = require('../../src/modules/pqrs/pqrs.state-machine');
const { ConflictError } = require('../../src/core/exceptions');

describe('pqrs.state-machine', () => {
  it('permite las transiciones del flujo principal', () => {
    expect(puedeTransicionar(ESTADOS.RADICADA, ESTADOS.EN_TRAMITE)).toBe(true);
    expect(puedeTransicionar(ESTADOS.EN_TRAMITE, ESTADOS.RESPONDIDA)).toBe(true);
    expect(puedeTransicionar(ESTADOS.RESPONDIDA, ESTADOS.CERRADA)).toBe(true);
    expect(puedeTransicionar(ESTADOS.RESPONDIDA, ESTADOS.EN_TRAMITE)).toBe(true);
    expect(puedeTransicionar(ESTADOS.RADICADA, ESTADOS.CERRADA)).toBe(true);
  });

  it('rechaza transiciones no permitidas', () => {
    expect(puedeTransicionar(ESTADOS.RADICADA, ESTADOS.RESPONDIDA)).toBe(false);
    expect(puedeTransicionar(ESTADOS.EN_TRAMITE, ESTADOS.CERRADA)).toBe(false);
    expect(puedeTransicionar(ESTADOS.CERRADA, ESTADOS.EN_TRAMITE)).toBe(false);
  });

  it('cerrada es un estado terminal sin transiciones', () => {
    expect(transicionesPermitidas(ESTADOS.CERRADA)).toEqual([]);
  });

  it('validarTransicion lanza ConflictError ante una transición inválida', () => {
    expect(() => validarTransicion(ESTADOS.CERRADA, ESTADOS.RADICADA)).toThrow(ConflictError);
  });

  it('validarTransicion devuelve true ante una transición válida', () => {
    expect(validarTransicion(ESTADOS.RADICADA, ESTADOS.EN_TRAMITE)).toBe(true);
  });
});

const {
  ESTADOS,
  puedeTransicionar,
  transicionesPermitidas,
  validarTransicion,
} = require('../../src/modules/solicitudes/solicitudes.state-machine');
const { ConflictError } = require('../../src/core/exceptions');

describe('solicitudes.state-machine', () => {
  it('permite el flujo con aprobación', () => {
    expect(puedeTransicionar(ESTADOS.PENDING, ESTADOS.IN_REVIEW)).toBe(true);
    expect(puedeTransicionar(ESTADOS.IN_REVIEW, ESTADOS.APPROVED)).toBe(true);
    expect(puedeTransicionar(ESTADOS.IN_REVIEW, ESTADOS.REJECTED)).toBe(true);
    expect(puedeTransicionar(ESTADOS.APPROVED, ESTADOS.CLOSED)).toBe(true);
    expect(puedeTransicionar(ESTADOS.REJECTED, ESTADOS.CLOSED)).toBe(true);
  });

  it('rechaza transiciones no permitidas', () => {
    expect(puedeTransicionar(ESTADOS.PENDING, ESTADOS.APPROVED, { requiereAprobacion: true })).toBe(
      false,
    );
    expect(puedeTransicionar(ESTADOS.CLOSED, ESTADOS.PENDING)).toBe(false);
  });

  it('permite pending -> approved cuando el tipo no requiere aprobación', () => {
    expect(puedeTransicionar(ESTADOS.PENDING, ESTADOS.APPROVED, { requiereAprobacion: false })).toBe(
      true,
    );
    expect(transicionesPermitidas(ESTADOS.PENDING, { requiereAprobacion: false })).toEqual(
      expect.arrayContaining([ESTADOS.IN_REVIEW, ESTADOS.APPROVED]),
    );
  });

  it('validarTransicion lanza ConflictError ante transición inválida', () => {
    expect(() => validarTransicion(ESTADOS.CLOSED, ESTADOS.APPROVED)).toThrow(ConflictError);
  });
});

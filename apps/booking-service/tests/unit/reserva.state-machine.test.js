const {
  ESTADOS,
  ESTADOS_BLOQUEANTES,
  transicionesPermitidas,
  esTransicionPermitida,
  esEstadoTerminal,
  assertTransicion,
} = require('../../src/modules/reservas/reserva.state-machine');
const { ConflictError } = require('../../src/core/exceptions');

describe('reserva.state-machine', () => {
  it('permite el flujo principal de la reserva', () => {
    expect(esTransicionPermitida(ESTADOS.PENDING, ESTADOS.APPROVED)).toBe(true);
    expect(esTransicionPermitida(ESTADOS.APPROVED, ESTADOS.CONFIRMED)).toBe(true);
    expect(esTransicionPermitida(ESTADOS.CONFIRMED, ESTADOS.COMPLETED)).toBe(true);
    expect(esTransicionPermitida(ESTADOS.CONFIRMED, ESTADOS.CANCELLED)).toBe(true);
    expect(esTransicionPermitida(ESTADOS.CONFIRMED, ESTADOS.NO_SHOW)).toBe(true);
    expect(esTransicionPermitida(ESTADOS.PENDING, ESTADOS.REJECTED)).toBe(true);
  });

  it('rechaza transiciones no permitidas', () => {
    expect(esTransicionPermitida(ESTADOS.PENDING, ESTADOS.CONFIRMED)).toBe(false);
    expect(esTransicionPermitida(ESTADOS.REJECTED, ESTADOS.APPROVED)).toBe(false);
    expect(esTransicionPermitida(ESTADOS.COMPLETED, ESTADOS.CANCELLED)).toBe(false);
  });

  it('identifica estados terminales', () => {
    expect(esEstadoTerminal(ESTADOS.COMPLETED)).toBe(true);
    expect(esEstadoTerminal(ESTADOS.CANCELLED)).toBe(true);
    expect(esEstadoTerminal(ESTADOS.PENDING)).toBe(false);
    expect(transicionesPermitidas(ESTADOS.COMPLETED)).toEqual([]);
  });

  it('assertTransicion lanza ConflictError ante transición inválida', () => {
    expect(() => assertTransicion(ESTADOS.COMPLETED, ESTADOS.PENDING)).toThrow(ConflictError);
    expect(assertTransicion(ESTADOS.PENDING, ESTADOS.APPROVED)).toBe(true);
  });

  it('los estados bloqueantes son los que ocupan el horario', () => {
    expect(ESTADOS_BLOQUEANTES).toEqual([ESTADOS.PENDING, ESTADOS.APPROVED, ESTADOS.CONFIRMED]);
  });
});

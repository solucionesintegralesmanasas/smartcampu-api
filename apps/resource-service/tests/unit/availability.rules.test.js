const { evaluarDisponibilidad } = require('../../src/modules/availability/availability.rules');

const recurso = { id: 1, uuid: 'r-uuid', nombre: 'Sala', activo: true, estadoReservable: true };
const horario = { horaApertura: '08:00', horaCierre: '18:00' };

const evaluar = (overrides = {}) =>
  evaluarDisponibilidad({
    recurso,
    horario,
    bloqueos: [],
    fecha: '2026-03-02',
    horaInicio: '09:00',
    horaFin: '10:00',
    ...overrides,
  });

describe('evaluarDisponibilidad', () => {
  it('marca disponible cuando el recurso está activo, en horario y sin bloqueos', () => {
    expect(evaluar()).toEqual({ disponible: true, motivo: null });
  });

  it('rechaza recursos inactivos', () => {
    const r = evaluar({ recurso: { ...recurso, activo: false } });
    expect(r.disponible).toBe(false);
    expect(r.motivo).toMatch(/inactivo/i);
  });

  it('rechaza recursos cuyo estado no permite reservas', () => {
    const r = evaluar({ recurso: { ...recurso, estadoReservable: false } });
    expect(r.disponible).toBe(false);
    expect(r.motivo).toMatch(/estado/i);
  });

  it('rechaza cuando no hay horario para el día', () => {
    const r = evaluar({ horario: null });
    expect(r.disponible).toBe(false);
    expect(r.motivo).toMatch(/horario/i);
  });

  it('rechaza franjas fuera del horario', () => {
    expect(evaluar({ horaInicio: '07:00', horaFin: '08:00' }).disponible).toBe(false);
    expect(evaluar({ horaInicio: '17:00', horaFin: '19:00' }).disponible).toBe(false);
  });

  it('rechaza cuando un bloqueo se solapa', () => {
    const bloqueos = [{ inicio: '2026-03-02 09:30:00', fin: '2026-03-02 11:00:00', motivo: 'Mantenimiento' }];
    const r = evaluar({ bloqueos });
    expect(r.disponible).toBe(false);
    expect(r.motivo).toMatch(/Mantenimiento/);
  });

  it('permite franjas que no se solapan con el bloqueo', () => {
    const bloqueos = [{ inicio: '2026-03-02 12:00:00', fin: '2026-03-02 13:00:00' }];
    expect(evaluar({ bloqueos }).disponible).toBe(true);
  });

  it('valida que la hora de fin sea posterior a la de inicio', () => {
    const r = evaluar({ horaInicio: '10:00', horaFin: '09:00' });
    expect(r.disponible).toBe(false);
  });
});

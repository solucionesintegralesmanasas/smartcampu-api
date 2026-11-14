const {
  toSegundos,
  normalizarHora,
  haySolape,
  validarReglasTipo,
} = require('../../src/modules/reservas/reserva.rules');

describe('reserva.rules', () => {
  it('toSegundos convierte HH:mm y HH:mm:ss', () => {
    expect(toSegundos('01:00')).toBe(3600);
    expect(toSegundos('01:30:30')).toBe(5430);
  });

  it('normalizarHora completa los segundos', () => {
    expect(normalizarHora('08:00')).toBe('08:00:00');
    expect(normalizarHora('08:00:00')).toBe('08:00:00');
  });

  it('haySolape detecta intervalos semiabiertos', () => {
    expect(haySolape({ horaInicio: '08:00', horaFin: '10:00' }, { horaInicio: '09:00', horaFin: '11:00' })).toBe(true);
    expect(haySolape({ horaInicio: '08:00', horaFin: '10:00' }, { horaInicio: '10:00', horaFin: '12:00' })).toBe(false);
    expect(haySolape({ horaInicio: '08:00', horaFin: '10:00' }, { horaInicio: '10:30', horaFin: '11:00' })).toBe(false);
  });

  it('validarReglasTipo no reporta incumplimientos cuando cumple', () => {
    const tipo = { antelacionMaximaDias: 30, maxDuracionMinutos: 120 };
    const incumplimientos = validarReglasTipo(
      tipo,
      { fecha: '2026-05-10', horaInicio: '08:00:00', horaFin: '09:00:00' },
      '2026-05-01',
    );
    expect(incumplimientos).toEqual([]);
  });

  it('validarReglasTipo detecta fecha pasada, antelación y duración', () => {
    const tipo = { antelacionMaximaDias: 5, maxDuracionMinutos: 60 };
    const incumplimientos = validarReglasTipo(
      tipo,
      { fecha: '2026-05-20', horaInicio: '08:00:00', horaFin: '10:00:00' },
      '2026-05-01',
    );
    const campos = incumplimientos.map((i) => i.field);
    expect(campos).toContain('fecha');
    expect(campos).toContain('horaFin');
  });
});

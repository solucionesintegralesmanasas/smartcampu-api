const { formatFecha, formatHora, ZONA_HORARIA } = require('../../src/core/helpers/fecha.helper');

describe('fecha.helper', () => {
  it('usa la zona horaria institucional', () => {
    expect(ZONA_HORARIA).toBe('America/Bogota');
  });

  it('formatFecha convierte a fecha local YYYY-MM-DD', () => {
    // 15:30 UTC = 10:30 en Bogotá (UTC-5): mismo día.
    expect(formatFecha('2026-05-01T15:30:00Z')).toBe('2026-05-01');
    // 02:00 UTC = 21:00 del día anterior en Bogotá.
    expect(formatFecha('2026-05-02T02:00:00Z')).toBe('2026-05-01');
  });

  it('formatHora convierte a HH:mm local', () => {
    expect(formatHora('2026-05-01T15:30:00Z')).toBe('10:30');
  });
});

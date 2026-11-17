const {
  isValidDate,
  timeToMinutes,
  getDayOfWeek,
  addDays,
  toMysqlDateTime,
  toMysqlTime,
} = require('../../src/core/helpers/time.helper');

describe('time.helper', () => {
  it('isValidDate valida fechas reales del calendario', () => {
    expect(isValidDate('2026-02-28')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('28-02-2026')).toBe(false);
  });

  it('timeToMinutes convierte HH:mm a minutos', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('08:30')).toBe(510);
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('getDayOfWeek devuelve 0=domingo … 6=sábado', () => {
    expect(getDayOfWeek('2026-03-01')).toBe(0); // domingo
    expect(getDayOfWeek('2026-03-02')).toBe(1); // lunes
    expect(getDayOfWeek('2026-03-07')).toBe(6); // sábado
  });

  it('addDays suma días y conserva el formato', () => {
    expect(addDays('2026-03-02', 5)).toBe('2026-03-07');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('toMysqlDateTime y toMysqlTime agregan los segundos', () => {
    expect(toMysqlDateTime('2026-03-02T08:30')).toBe('2026-03-02 08:30:00');
    expect(toMysqlTime('08:30')).toBe('08:30:00');
  });
});

const {
  parseFestivos,
  obtenerFechaLocal,
  esDiaHabil,
  sumarDiasHabiles,
} = require('../../src/core/helpers/business-days.helper');

describe('business-days.helper', () => {
  it('parseFestivos convierte la lista separada por comas en un conjunto', () => {
    const festivos = parseFestivos('2026-01-01, 2026-05-01');
    expect(festivos.has('2026-01-01')).toBe(true);
    expect(festivos.has('2026-05-01')).toBe(true);
    expect(festivos.size).toBe(2);
  });

  it('esDiaHabil excluye fines de semana y festivos', () => {
    expect(esDiaHabil('2026-03-02')).toBe(true); // lunes
    expect(esDiaHabil('2026-03-07')).toBe(false); // sábado
    expect(esDiaHabil('2026-03-08')).toBe(false); // domingo
    expect(esDiaHabil('2026-03-02', new Set(['2026-03-02']))).toBe(false);
  });

  it('sumarDiasHabiles cuenta solo días laborables', () => {
    // Viernes 2026-03-06 + 1 día hábil = lunes 2026-03-09
    expect(sumarDiasHabiles('2026-03-06', 1)).toBe('2026-03-09');
    // Lunes 2026-03-02 + 5 días hábiles = lunes 2026-03-09
    expect(sumarDiasHabiles('2026-03-02', 5)).toBe('2026-03-09');
  });

  it('sumarDiasHabiles respeta los festivos', () => {
    // Lunes 2026-03-02 + 1 día hábil, saltando el martes festivo = miércoles 2026-03-04
    const festivos = new Set(['2026-03-03']);
    expect(sumarDiasHabiles('2026-03-02', 1, festivos)).toBe('2026-03-04');
  });

  it('obtenerFechaLocal devuelve una fecha YYYY-MM-DD', () => {
    expect(obtenerFechaLocal(new Date('2026-03-02T12:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

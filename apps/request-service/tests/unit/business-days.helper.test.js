const {
  parseFestivos,
  obtenerFechaLocal,
  esDiaHabil,
  sumarDiasHabiles,
} = require('../../src/core/helpers/business-days.helper');

describe('business-days.helper', () => {
  it('parseFestivos construye el conjunto de festivos', () => {
    const festivos = parseFestivos('2026-01-01, 2026-05-01');
    expect(festivos.has('2026-01-01')).toBe(true);
    expect(festivos.size).toBe(2);
  });

  it('esDiaHabil excluye fines de semana y festivos', () => {
    expect(esDiaHabil('2026-03-02')).toBe(true); // lunes
    expect(esDiaHabil('2026-03-07')).toBe(false); // sábado
    expect(esDiaHabil('2026-03-02', new Set(['2026-03-02']))).toBe(false);
  });

  it('sumarDiasHabiles cuenta solo días laborables', () => {
    expect(sumarDiasHabiles('2026-03-06', 1)).toBe('2026-03-09'); // viernes + 1 = lunes
    expect(sumarDiasHabiles('2026-03-02', 5)).toBe('2026-03-09');
  });

  it('obtenerFechaLocal devuelve YYYY-MM-DD', () => {
    expect(obtenerFechaLocal(new Date('2026-03-02T12:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

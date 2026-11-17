const { ValidationError } = require('../../src/core/exceptions');
const { fileFilter, MAX_FILE_SIZE } = require('../../src/modules/archivo/archivo.upload');

describe('archivo.upload fileFilter', () => {
  it('toma el límite de tamaño desde STORAGE_MAX_SIZE', () => {
    expect(MAX_FILE_SIZE).toBe(10485760);
  });

  it.each(['documento.pdf', 'foto.jpg', 'foto.JPEG', 'imagen.png', 'animado.gif'])(
    'acepta la extensión permitida %s',
    (originalname) => {
      const cb = jest.fn();
      fileFilter({}, { originalname }, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    },
  );

  it('rechaza una extensión no permitida con ValidationError', () => {
    const cb = jest.fn();
    fileFilter({}, { originalname: 'script.exe' }, cb);
    expect(cb).toHaveBeenCalledWith(expect.any(ValidationError));
  });
});

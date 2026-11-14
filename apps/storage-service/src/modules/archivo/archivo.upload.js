const path = require('path');

const multer = require('multer');

const { env } = require('../../config/env');
const { ValidationError } = require('../../core/exceptions');

const { ALLOWED_EXTENSIONS } = require('./archivo.validation');

const FIELD_NAME = 'archivo';

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return cb(
      new ValidationError(
        `Tipo de archivo no permitido. Extensiones válidas: ${ALLOWED_EXTENSIONS.join(', ')}`,
      ),
    );
  }
  return cb(null, true);
};

const multerUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: env.MAX_FILE_SIZE, files: 1 },
});

/**
 * Procesa un único archivo multipart en el campo `archivo` y traduce los
 * errores de multer a ValidationError (400).
 */
const uploadArchivo = (req, res, next) => {
  multerUpload.single(FIELD_NAME)(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? `El archivo supera el tamaño máximo permitido de ${env.MAX_FILE_SIZE} bytes`
        : `Campo de archivo no válido. Use el campo "${FIELD_NAME}"`;
      return next(new ValidationError(message));
    }
    return next(error);
  });
};

module.exports = { uploadArchivo, fileFilter, FIELD_NAME };

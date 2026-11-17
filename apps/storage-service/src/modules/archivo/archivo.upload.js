const path = require('node:path');

const multer = require('multer');

const { env } = require('../../config/env');
const { ValidationError } = require('../../core/exceptions');

// Solo PDFs e imágenes: mismo whitelist que el spec original. La extensión se
// valida aquí (rápido, antes de leer el archivo completo); el mime-type
// reportado por el cliente se registra pero no es la única línea de defensa,
// ya que el nombre final en disco siempre lo genera el servidor (UUID), nunca
// el nombre ni el contenido del archivo subido.
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.gif']);

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(
      new ValidationError(`Invalid file type. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`),
    );
  }
  return cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.STORAGE_MAX_SIZE },
});

module.exports = {
  upload, fileFilter, ALLOWED_EXTENSIONS, MAX_FILE_SIZE: env.STORAGE_MAX_SIZE,
};

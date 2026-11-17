const { env } = require('./env');
const logger = require('./logger');

/**
 * Cliente de correo. Si SMTP_HOST no está configurado (p. ej. en desarrollo
 * o mientras no se ha elegido un proveedor de correo), no falla en
 * silencio: registra el contenido completo (incluido cualquier enlace/token)
 * en el logger con status 'logged_only', para que el mensaje siga siendo
 * recuperable durante pruebas manuales en vez de perderse.
 */
function isSmtpConfigured() {
  return Boolean(env.SMTP_HOST);
}

let transporterPromise;

function getTransporter() {
  if (!transporterPromise) {
    // Import perezoso: nodemailer solo es necesario si de verdad hay SMTP configurado.
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const nodemailer = require('nodemailer');
    transporterPromise = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }
  return transporterPromise;
}

/**
 * Envía un correo. Devuelve { delivered: boolean } indicando si de verdad
 * se envió por SMTP o si solo quedó registrado en logs.
 * @param {{to: string, subject: string, text: string, html?: string}} message
 */
async function sendMail({
  to, subject, text, html,
}) {
  if (!isSmtpConfigured()) {
    logger.warn('SMTP no configurado: correo no enviado, solo registrado', {
      to,
      subject,
      text,
    });
    return { delivered: false };
  }

  const transporter = getTransporter();
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
  return { delivered: true };
}

module.exports = { sendMail, isSmtpConfigured };

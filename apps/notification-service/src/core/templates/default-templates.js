/**
 * Plantillas por defecto (canal in_app) usadas cuando la tabla notification_templates
 * no tiene un registro para el código. Si existe un registro activo en BD, la BD tiene prioridad.
 */
const DEFAULT_TEMPLATES = Object.freeze({
  'request.created': Object.freeze({
    code: 'request.created',
    name: 'Solicitud creada',
    channel: 'in_app',
    subject: 'Solicitud {{numero_solicitud}} registrada',
    bodyText: 'Tu solicitud {{numero_solicitud}} de {{tipo_tramite}} fue registrada correctamente. {{descripcion}}',
    variables: ['numero_solicitud', 'tipo_tramite', 'descripcion'],
  }),
  'request.status_changed': Object.freeze({
    code: 'request.status_changed',
    name: 'Cambio de estado de trámite',
    channel: 'in_app',
    subject: 'Tu solicitud {{codigo_tramite}} cambió de estado',
    bodyText: 'Tu trámite de {{tipo_tramite}} ahora se encuentra en estado: {{nuevo_estado}}.',
    variables: ['codigo_tramite', 'tipo_tramite', 'nuevo_estado'],
  }),
  'booking.confirmed': Object.freeze({
    code: 'booking.confirmed',
    name: 'Reserva confirmada',
    channel: 'in_app',
    subject: 'Reserva confirmada: {{recurso}} para el {{fecha}}',
    bodyText: 'Tu reserva del recurso {{recurso}} fue confirmada para el {{fecha}} entre {{hora_inicio}} y {{hora_fin}}.',
    variables: ['recurso', 'fecha', 'hora_inicio', 'hora_fin'],
  }),
  'event.scheduled': Object.freeze({
    code: 'event.scheduled',
    name: 'Evento programado',
    channel: 'in_app',
    subject: 'Nuevo evento: {{nombre}}',
    bodyText: 'Se programó el evento {{nombre}} el {{fecha}} a las {{hora}} en {{sede}}.',
    variables: ['nombre', 'fecha', 'hora', 'sede'],
  }),
  'pqrs.answered': Object.freeze({
    code: 'pqrs.answered',
    name: 'PQRS respondida',
    channel: 'in_app',
    subject: 'Tu PQRS de tipo {{tipo_pqrs}} fue respondida',
    bodyText: 'Hemos respondido tu PQRS de tipo {{tipo_pqrs}}: {{respuesta}}',
    variables: ['tipo_pqrs', 'respuesta'],
  }),
});

/**
 * @param {string} code - Código de plantilla.
 * @returns {Object|null} Plantilla por defecto o null si no existe.
 */
const getDefaultTemplate = (code) => DEFAULT_TEMPLATES[code] || null;

module.exports = { DEFAULT_TEMPLATES, getDefaultTemplate };

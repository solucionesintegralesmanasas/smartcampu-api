/**
 * DTOs canónicos del dominio general (solicitudes, reservas, recursos, eventos,
 * PQRS, notificaciones y archivos).
 *
 * @module domain.types
 */

/**
 * @typedef {'PENDIENTE' | 'EN_REVISION' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA' | 'CERRADA'} SolicitudEstado
 * @typedef {'ALTA' | 'MEDIA' | 'BAJA'} SolicitudPrioridad
 * @typedef {'INFORMACION' | 'SERVICIOS' | 'RECLAMO' | 'SUGERENCIA' | 'OTRO'} SolicitudTipo
 */

/**
 * @typedef {Object} SolicitudDTO
 * @property {string}  uuid
 * @property {string}  numero_solicitud  - Código legible (p.ej. SOL-2026-00001).
 * @property {number}  id_usuario
 * @property {SolicitudTipo} tipo
 * @property {SolicitudEstado} estado
 * @property {SolicitudPrioridad} prioridad
 * @property {string}  descripcion
 * @property {Object}  fechas
 * @property {string}  fechas.creada      - ISO8601.
 * @property {string|null} fechas.actualizada
 * @property {string|null} fechas.cerrada
 */

/**
 * @typedef {'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'FINALIZADA' | 'NO_ASISTIO'} ReservaEstado
 * @typedef {'AULA' | 'LABORATORIO' | 'AUDITORIO' | 'DEPORTIVO' | 'EQUIPO' | 'OTRO'} ReservaTipo
 */

/**
 * @typedef {Object} ReservaDTO
 * @property {string}  uuid
 * @property {number}  id_usuario
 * @property {number}  id_recurso
 * @property {ReservaTipo} tipo
 * @property {ReservaEstado} estado
 * @property {string}  fecha_reserva   - YYYY-MM-DD
 * @property {string}  hora_inicio     - HH:mm
 * @property {string}  hora_fin        - HH:mm
 * @property {string|null} observaciones
 */

/**
 * @typedef {'ACTIVO' | 'INACTIVO' | 'MANTENIMIENTO'} RecursoEstado
 * @typedef {'AULA' | 'LABORATORIO' | 'AUDITORIO' | 'DEPORTIVO' | 'EQUIPO' | 'OTRO'} RecursoTipo
 */

/**
 * @typedef {Object} RecursoDTO
 * @property {string}  uuid
 * @property {string}  codigo          - Código interno (p.ej. LAB-01-A02).
 * @property {string}  nombre
 * @property {RecursoTipo} tipo
 * @property {RecursoEstado} estado
 * @property {string}  sede            - Nombre de la sede.
 * @property {string}  ubicacion       - Descripción de ubicación física.
 * @property {number}  capacidad       - Aforo máximo.
 */

/**
 * @typedef {'ACADEMICO' | 'CULTURAL' | 'DEPORTIVO' | 'CONVOCATORIA' | 'OTRO'} EventoTipo
 * @typedef {'PROGRAMADO' | 'CONFIRMADO' | 'CANCELADO' | 'FINALIZADO'} EventoEstado
 */

/**
 * @typedef {Object} EventoDTO
 * @property {string}  uuid
 * @property {string}  nombre
 * @property {string}  descripcion
 * @property {EventoTipo} tipo
 * @property {EventoEstado} estado
 * @property {string}  fecha_evento    - YYYY-MM-DD
 * @property {string}  hora_evento     - HH:mm
 * @property {string}  sede
 * @property {string}  lugar
 * @property {number}  cupo_maximo
 */

/**
 * @typedef {'PETICION' | 'QUEJA' | 'RECLAMO' | 'SUGERENCIA'} PqrsTipo
 * @typedef {'RADICADA' | 'EN_ATENCION' | 'RESPONDIDA' | 'CERRADA'} PqrsEstado
 */

/**
 * @typedef {Object} PqrsDTO
 * @property {string}  uuid
 * @property {number}  id_usuario
 * @property {PqrsTipo} tipo
 * @property {PqrsEstado} estado
 * @property {string}  asunto
 * @property {string}  descripcion
 * @property {string|null} responsable - Nombre del funcionario asignado.
 * @property {Object}  fechas
 * @property {string}  fechas.radicada
 * @property {string|null} fechas.respondida
 * @property {string|null} fechas.cerrada
 */

/**
 * @typedef {Object} PqrsRespuestaDTO
 * @property {string}  uuid
 * @property {string}  id_pqrs           - UUID de la PQRS asociada.
 * @property {number}  id_usuario_responde
 * @property {string}  respuesta
 * @property {string}  fecha             - ISO8601.
 */

/**
 * @typedef {'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH'} NotificacionTipo
 * @typedef {'PENDIENTE' | 'ENVIADA' | 'LEIDA' | 'FALLIDA'} NotificacionEstado
 */

/**
 * @typedef {Object} NotificacionDTO
 * @property {string}  uuid
 * @property {number}  id_usuario
 * @property {NotificacionTipo} tipo
 * @property {NotificacionEstado} estado
 * @property {string}  titulo
 * @property {string}  mensaje
 * @property {string|null} entidad_referencia - Nombre de la entidad (p.ej. 'solicitudes').
 * @property {string|null} uuid_referencia    - UUID del recurso relacionado.
 * @property {Object}  fechas
 * @property {string}  fechas.creada
 * @property {string|null} fechas.enviada
 * @property {string|null} fechas.leida
 */

/**
 * @typedef {Object} ArchivoDTO
 * @property {string}  uuid
 * @property {string}  nombre_original   - Nombre original al subir.
 * @property {string}  nombre_sistema    - Nombre generado internamente.
 * @property {string}  ruta_acceso       - Ruta relativa o URL.
 * @property {string}  mime_type         - p.ej. 'application/pdf'.
 * @property {number}  peso_bytes        - Tamaño en bytes.
 * @property {string}  entidad_asociada  - p.ej. 'solicitudes', 'pqrs'.
 * @property {string}  uuid_asociado     - UUID de la entidad asociada.
 */

/**
 * Catálogo de campos de cada DTO del dominio.
 */
const DOMAIN_DTO_FIELDS = Object.freeze({
  SolicitudDTO: Object.freeze([
    'uuid',
    'numero_solicitud',
    'id_usuario',
    'tipo',
    'estado',
    'prioridad',
    'descripcion',
    'fechas',
  ]),
  ReservaDTO: Object.freeze([
    'uuid',
    'id_usuario',
    'id_recurso',
    'tipo',
    'estado',
    'fecha_reserva',
    'hora_inicio',
    'hora_fin',
    'observaciones',
  ]),
  RecursoDTO: Object.freeze([
    'uuid',
    'codigo',
    'nombre',
    'tipo',
    'estado',
    'sede',
    'ubicacion',
    'capacidad',
  ]),
  EventoDTO: Object.freeze([
    'uuid',
    'nombre',
    'descripcion',
    'tipo',
    'estado',
    'fecha_evento',
    'hora_evento',
    'sede',
    'lugar',
    'cupo_maximo',
  ]),
  PqrsDTO: Object.freeze([
    'uuid',
    'id_usuario',
    'tipo',
    'estado',
    'asunto',
    'descripcion',
    'responsable',
    'fechas',
  ]),
  PqrsRespuestaDTO: Object.freeze(['uuid', 'id_pqrs', 'id_usuario_responde', 'respuesta', 'fecha']),
  NotificacionDTO: Object.freeze([
    'uuid',
    'id_usuario',
    'tipo',
    'estado',
    'titulo',
    'mensaje',
    'entidad_referencia',
    'uuid_referencia',
    'fechas',
  ]),
  ArchivoDTO: Object.freeze([
    'uuid',
    'nombre_original',
    'nombre_sistema',
    'ruta_acceso',
    'mime_type',
    'peso_bytes',
    'entidad_asociada',
    'uuid_asociado',
  ]),
});

module.exports = {
  DOMAIN_DTO_FIELDS,
};

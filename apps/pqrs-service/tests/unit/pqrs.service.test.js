jest.mock('@uajs/shared-types', () => ({
  EVENT_TYPES: { PQRS_RESPONDIDA: 'PqrsRespondidaEvent' },
}));

jest.mock('../../src/config/elasticsearch', () => ({
  esClient: { index: jest.fn().mockResolvedValue({}) },
}));

const { ForbiddenError, NotFoundError, ValidationError } = require('../../src/core/exceptions');
const PqrsService = require('../../src/modules/pqrs/pqrs.service');
const { ESTADOS } = require('../../src/modules/pqrs/pqrs.state-machine');

const RELOJ = () => new Date('2026-03-02T13:00:00Z'); // lunes

const filaPqrs = (overrides = {}) => ({
  id: 10,
  uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  ticket_number: 'PQRS-2026-000001',
  is_anonymous: 0,
  requester_uuid: 'user-1',
  requester_name: 'Ana Pérez',
  requester_email: 'ana@uajs.edu.co',
  assignee_uuid: null,
  assignee_name: null,
  subject: 'Asunto',
  description: 'Descripción suficientemente larga',
  filed_at: '2026-03-02 13:00:00',
  response_due_date: '2026-03-23',
  responded_at: null,
  closed_at: null,
  satisfaction_score: null,
  created_at: '2026-03-02 13:00:00',
  updated_at: '2026-03-02 13:00:00',
  tipo_uuid: 'tipo-1',
  tipo_codigo: 'QUEJA',
  tipo_nombre: 'Queja',
  tipo_plazo_dias: 15,
  estado_id: 2,
  estado_codigo: ESTADOS.EN_TRAMITE,
  estado_nombre: 'En trámite',
  estado_color: '#F59E0B',
  estado_terminal: 0,
  ...overrides,
});

const crearRepositorio = (overrides = {}) => ({
  findTipoByCode: jest.fn().mockResolvedValue({ id: 1, code: 'QUEJA', plazoDias: 15 }),
  findEstadoByCode: jest.fn().mockResolvedValue({ id: 1, code: ESTADOS.RADICADA }),
  siguienteSecuencia: jest.fn().mockResolvedValue(1),
  insertPqrs: jest.fn().mockResolvedValue(10),
  insertAuditoria: jest.fn().mockResolvedValue(undefined),
  insertRespuesta: jest.fn().mockResolvedValue(55),
  updateAsignacion: jest.fn().mockResolvedValue(undefined),
  updateEstado: jest.fn().mockResolvedValue(undefined),
  updateCalificacion: jest.fn().mockResolvedValue(undefined),
  findByUuid: jest.fn().mockResolvedValue(filaPqrs()),
  findByTicket: jest.fn().mockResolvedValue(filaPqrs()),
  findPqrs: jest.fn().mockResolvedValue({ rows: [filaPqrs()], total: 1 }),
  findRespuestas: jest.fn().mockResolvedValue([]),
  withTransaction: jest.fn((callback) => callback({ query: jest.fn() })),
  ...overrides,
});

const crearProducer = () => ({ publicar: jest.fn().mockResolvedValue({}) });

const usuario = { id: 'user-1', uuid: 'user-1', nombre: 'Ana Pérez', correo: 'ana@uajs.edu.co', rol: 'STUDENT' };
const personal = { id: 'staff-1', uuid: 'staff-1', nombre: 'Luis Staff', correo: 'luis@uajs.edu.co', rol: 'STAFF' };

describe('PqrsService.crear', () => {
  it('rechaza un tipo inexistente', async () => {
    const repo = crearRepositorio({ findTipoByCode: jest.fn().mockResolvedValue(null) });
    const service = new PqrsService(repo, crearProducer(), { festivos: new Set(), reloj: RELOJ });

    await expect(
      service.crear(usuario, { tipoCodigo: 'X', asunto: 'Asunto', descripcion: 'Descripción larga' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('exige autenticación o anonimato', async () => {
    const service = new PqrsService(crearRepositorio(), crearProducer(), {
      festivos: new Set(),
      reloj: RELOJ,
    });

    await expect(
      service.crear(null, { tipoCodigo: 'QUEJA', asunto: 'Asunto', descripcion: 'Descripción larga' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('radica una PQRS y devuelve el número con formato', async () => {
    const repo = crearRepositorio();
    const service = new PqrsService(repo, crearProducer(), { festivos: new Set(), reloj: RELOJ });

    const resultado = await service.crear(usuario, {
      tipoCodigo: 'QUEJA',
      asunto: 'Asunto',
      descripcion: 'Descripción suficientemente larga',
      anonima: false,
    });

    expect(resultado.numeroRadicado).toBe('PQRS-2026-000001');
    expect(repo.insertPqrs).toHaveBeenCalled();
    expect(repo.insertAuditoria).toHaveBeenCalled();
  });

  it('radica una PQRS anónima sin solicitante', async () => {
    const repo = crearRepositorio();
    const service = new PqrsService(repo, crearProducer(), { festivos: new Set(), reloj: RELOJ });

    await service.crear(null, {
      tipoCodigo: 'QUEJA',
      asunto: 'Asunto',
      descripcion: 'Descripción suficientemente larga',
      anonima: true,
      email: 'anonimo@correo.com',
    });

    const [datosInsert] = repo.insertPqrs.mock.calls[0];
    expect(datosInsert.esAnonima).toBe(true);
    expect(datosInsert.solicitanteUuid).toBeNull();
  });
});

describe('PqrsService.responder', () => {
  it('solo el personal puede responder', async () => {
    const service = new PqrsService(crearRepositorio(), crearProducer(), {
      festivos: new Set(),
      reloj: RELOJ,
    });

    await expect(
      service.responder(usuario, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', { cuerpo: 'Respuesta' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('al responder en definitiva mueve a respondida y publica el evento', async () => {
    const repo = crearRepositorio({
      findByUuid: jest.fn().mockResolvedValue(filaPqrs({ estado_codigo: ESTADOS.EN_TRAMITE })),
    });
    const producer = crearProducer();
    const service = new PqrsService(repo, producer, { festivos: new Set(), reloj: RELOJ });

    await service.responder(personal, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
      cuerpo: 'Respuesta definitiva',
      esFinal: true,
    });

    expect(repo.insertRespuesta).toHaveBeenCalled();
    expect(repo.updateEstado).toHaveBeenCalled();
    expect(producer.publicar).toHaveBeenCalledWith(
      'PqrsRespondidaEvent',
      expect.objectContaining({ pqrsUuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
    );
  });
});

describe('PqrsService.obtener', () => {
  it('un tercero no puede ver la PQRS de otro', async () => {
    const service = new PqrsService(crearRepositorio(), crearProducer(), {
      festivos: new Set(),
      reloj: RELOJ,
    });
    const otro = { ...usuario, uuid: 'otro-user' };

    await expect(
      service.obtener(otro, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('el dueño puede ver su PQRS', async () => {
    const service = new PqrsService(crearRepositorio(), crearProducer(), {
      festivos: new Set(),
      reloj: RELOJ,
    });

    const detalle = await service.obtener(usuario, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(detalle.numeroRadicado).toBe('PQRS-2026-000001');
  });
});

describe('PqrsService.calificar', () => {
  it('rechaza calificar en estado no permitido', async () => {
    const repo = crearRepositorio({
      findByUuid: jest.fn().mockResolvedValue(filaPqrs({ estado_codigo: ESTADOS.RADICADA })),
    });
    const service = new PqrsService(repo, crearProducer(), { festivos: new Set(), reloj: RELOJ });

    await expect(
      service.calificar(usuario, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', { puntaje: 5 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('permite calificar una PQRS respondida', async () => {
    const repo = crearRepositorio({
      findByUuid: jest.fn().mockResolvedValue(filaPqrs({ estado_codigo: ESTADOS.RESPONDIDA })),
    });
    const service = new PqrsService(repo, crearProducer(), { festivos: new Set(), reloj: RELOJ });

    await service.calificar(usuario, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', { puntaje: 5 });
    expect(repo.updateCalificacion).toHaveBeenCalledWith(10, 5);
  });
});

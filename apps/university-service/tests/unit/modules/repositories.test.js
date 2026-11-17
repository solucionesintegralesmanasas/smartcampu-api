const DocenteRepository = require('../../../src/modules/docente/docente.repository');
const EmpresaRepository = require('../../../src/modules/empresa/empresa.repository');
const EstudianteRepository = require('../../../src/modules/estudiante/estudiante.repository');
const FacultadRepository = require('../../../src/modules/facultad/facultad.repository');
const ProgramaRepository = require('../../../src/modules/programa/programa.repository');
const TerceroRepository = require('../../../src/modules/tercero/tercero.repository');

describe('Pruebas Unitarias de Repositorios con MockPool', () => {
  let mockConn;
  let mockPool;

  beforeEach(() => {
    mockConn = {
      query: jest.fn(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn().mockResolvedValue(),
    };

    mockPool = {
      query: jest.fn(),
      beginTransaction: jest.fn().mockResolvedValue(mockConn),
      getConnection: jest.fn().mockResolvedValue(mockConn),
      ping: jest.fn().mockResolvedValue(true),
    };
  });

  describe('EmpresaRepository', () => {
    let repo;
    beforeEach(() => {
      repo = new EmpresaRepository(mockPool);
    });

    it('debe ejecutar withTransaction exitosamente', async () => {
      const result = await repo.withTransaction(async (conn) => {
        expect(conn).toBe(mockConn);
        return 'ok';
      });
      expect(result).toBe('ok');
      expect(mockConn.commit).toHaveBeenCalled();
      expect(mockConn.release).toHaveBeenCalled();
    });

    it('debe hacer rollback si withTransaction falla', async () => {
      await expect(
        repo.withTransaction(async () => {
          throw new Error('Fallo transaccional');
        }),
      ).rejects.toThrow('Fallo transaccional');
      expect(mockConn.rollback).toHaveBeenCalled();
      expect(mockConn.release).toHaveBeenCalled();
    });

    it('create debe insertar y retornar findById', async () => {
      mockPool.query
        .mockResolvedValueOnce({ insertId: 1 })
        .mockResolvedValueOnce([{ id: 1, razonSocial: 'Empresa Test', is_active: 1 }]);

      const created = await repo.create({
        razonSocial: 'Empresa Test',
        nit: '9001',
        activo: true,
      });

      expect(created.id).toBe(1);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('findAll debe manejar parámetros de paginación y búsqueda', async () => {
      mockPool.query
        .mockResolvedValueOnce([{ total: 1 }])
        .mockResolvedValueOnce([{ id: 1, razonSocial: 'Empresa Buscada' }]);

      const res = await repo.findAll({ page: 1, limit: 10, search: 'Buscada' });
      expect(res.data).toHaveLength(1);
      expect(res.pagination.total).toBe(1);
    });

    it('findById debe soportar id numérico y uuid', async () => {
      mockPool.query.mockResolvedValueOnce([{ id: 1, razonSocial: 'Empresa 1' }]);
      const resNum = await repo.findById(1);
      expect(resNum.id).toBe(1);

      mockPool.query.mockResolvedValueOnce([
        { id: 2, uuid: 'a-b-c-d-e-f-g-h-i-j-k-l-m-n-o-p-q-r-s' },
      ]);
      const resUuid = await repo.findById('12345678-1234-1234-1234-123456789012');
      expect(resUuid.id).toBe(2);
      expect(mockPool.query).toHaveBeenCalled();
    });

    it('findByNit debe buscar por tax_id', async () => {
      mockPool.query.mockResolvedValueOnce([{ id: 1, nit: '9001' }]);
      const res = await repo.findByNit('9001');
      expect(res.id).toBe(1);
    });

    it('update debe actualizar campos y retornar registro actualizado', async () => {
      mockPool.query
        .mockResolvedValueOnce([{ id: 1, razonSocial: 'Antigua', activo: 1 }])
        .mockResolvedValueOnce({ affectedRows: 1 })
        .mockResolvedValueOnce([{ id: 1, razonSocial: 'Nueva', activo: 1 }]);

      const updated = await repo.update(1, { razonSocial: 'Nueva' });
      expect(updated.razonSocial).toBe('Nueva');
    });

    it('update retorna null si no existe', async () => {
      mockPool.query.mockResolvedValueOnce([]);
      const updated = await repo.update(999, { razonSocial: 'No existe' });
      expect(updated).toBeNull();
    });

    it('countAssociatedTerceros retorna 0 sin relación en el esquema', async () => {
      const count = await repo.countAssociatedTerceros(1);
      expect(count).toBe(0);
    });

    it('delete debe marcar inactivo el registro', async () => {
      mockPool.query.mockResolvedValueOnce({ affectedRows: 1 });
      const del = await repo.delete(1);
      expect(del).toBe(true);
    });
  });

  describe('TerceroRepository', () => {
    let repo;
    beforeEach(() => {
      repo = new TerceroRepository(mockPool);
    });

    it('create debe insertar una persona y retornar findById', async () => {
      mockPool.query.mockResolvedValueOnce({ insertId: 10 }).mockResolvedValueOnce([
        {
          id: 10,
          primerNombre: 'Carlos',
          primerApellido: 'Gómez',
        },
      ]);

      const created = await repo.create({
        tipoDocumento: 'CC',
        numeroDocumento: '12345',
        primerNombre: 'Carlos',
        primerApellido: 'Gómez',
      });

      expect(created.id).toBe(10);
      expect(created.Empresa).toBeNull();
    });

    it('findAll debe filtrar por tipoDocumento y search', async () => {
      mockPool.query
        .mockResolvedValueOnce([{ total: 1 }])
        .mockResolvedValueOnce([{ id: 10, primerNombre: 'Ana' }]);

      const res = await repo.findAll({
        page: 1,
        limit: 10,
        search: 'Ana',
        tipoDocumento: 'CC',
      });

      expect(res.data).toHaveLength(1);
      expect(res.data[0].Empresa).toBeNull();
    });

    it('findByDocumento debe consultar por tipo y número', async () => {
      mockPool.query.mockResolvedValueOnce([
        { id: 10, tipoDocumento: 'CC', numeroDocumento: '123' },
      ]);
      const res = await repo.findByDocumento('CC', '123');
      expect(res.id).toBe(10);
    });

    it('update debe actualizar los datos de la persona', async () => {
      mockPool.query
        .mockResolvedValueOnce([
          {
            id: 10,
            primerNombre: 'Viejo',
            tipoDocumento: 'CC',
            numeroDocumento: '123',
          },
        ])
        .mockResolvedValueOnce({ affectedRows: 1 })
        .mockResolvedValueOnce([
          {
            id: 10,
            primerNombre: 'Nuevo',
            tipoDocumento: 'CC',
            numeroDocumento: '123',
          },
        ]);

      const updated = await repo.update(10, { primerNombre: 'Nuevo' });
      expect(updated.primerNombre).toBe('Nuevo');
    });

    it('countStudentLinks y countTeacherLinks deben contar vínculos', async () => {
      mockPool.query.mockResolvedValueOnce([{ total: 2 }]);
      expect(await repo.countStudentLinks(10)).toBe(2);

      mockPool.query.mockResolvedValueOnce([{ total: 3 }]);
      expect(await repo.countTeacherLinks(10)).toBe(3);
    });

    it('delete debe marcar inactivo y registrar deleted_at', async () => {
      mockPool.query.mockResolvedValueOnce({ affectedRows: 1 });
      expect(await repo.delete(10)).toBe(true);
    });
  });

  describe('FacultadRepository', () => {
    let repo;
    beforeEach(() => {
      repo = new FacultadRepository(mockPool);
    });

    it('create debe insertar y retornar facultad', async () => {
      mockPool.query
        .mockResolvedValueOnce({ insertId: 1 })
        .mockResolvedValueOnce([{ id: 1, nombre: 'Ingeniería', codigo: 'FING' }]);

      const created = await repo.create({
        campusId: 1,
        codigo: 'FING',
        nombre: 'Ingeniería',
      });

      expect(created.id).toBe(1);
    });

    it('findAll con búsqueda y campusId', async () => {
      mockPool.query
        .mockResolvedValueOnce([{ total: 1 }])
        .mockResolvedValueOnce([{ id: 1, nombre: 'Ingeniería' }]);

      const res = await repo.findAll({
        page: 1,
        limit: 10,
        search: 'Ing',
        campusId: 1,
      });
      expect(res.data).toHaveLength(1);
    });

    it('findByCodigo y findByNombre', async () => {
      mockPool.query.mockResolvedValueOnce([{ id: 1, codigo: 'FING' }]);
      expect(await repo.findByCodigo('FING')).toEqual({ id: 1, codigo: 'FING' });

      mockPool.query.mockResolvedValueOnce([{ id: 1, nombre: 'Ingeniería' }]);
      expect(await repo.findByNombre('Ingeniería')).toEqual({ id: 1, nombre: 'Ingeniería' });
    });

    it('update debe modificar la facultad', async () => {
      mockPool.query
        .mockResolvedValueOnce([
          {
            id: 1,
            nombre: 'Antigua',
            campusId: 1,
            codigo: 'F',
          },
        ])
        .mockResolvedValueOnce({ affectedRows: 1 })
        .mockResolvedValueOnce([{ id: 1, nombre: 'Modificada' }]);

      const updated = await repo.update(1, { nombre: 'Modificada' });
      expect(updated.nombre).toBe('Modificada');
    });

    it('countProgramLinks y countTeacherLinks', async () => {
      mockPool.query.mockResolvedValueOnce([{ total: 4 }]);
      expect(await repo.countProgramLinks(1)).toBe(4);

      mockPool.query.mockResolvedValueOnce([{ total: 8 }]);
      expect(await repo.countTeacherLinks(1)).toBe(8);
    });

    it('delete debe marcar inactiva la facultad', async () => {
      mockPool.query.mockResolvedValueOnce({ affectedRows: 1 });
      expect(await repo.delete(1)).toBe(true);
    });
  });

  describe('ProgramaRepository', () => {
    let repo;
    beforeEach(() => {
      repo = new ProgramaRepository(mockPool);
    });

    it('create debe insertar programa académico', async () => {
      mockPool.query.mockResolvedValueOnce({ insertId: 1 }).mockResolvedValueOnce([
        {
          id: 1,
          nombre: 'Sistemas',
          facultad_id: 1,
          facultad_nombre: 'Ingeniería',
          facultad_codigo: 'FING',
        },
      ]);

      const created = await repo.create({
        facultadId: 1,
        codigo: 'SIS',
        nombre: 'Sistemas',
        nivel: 'undergraduate',
        duracionSemestres: 10,
        creditosTotales: 160,
      });

      expect(created.id).toBe(1);
      expect(created.Facultad).toBeDefined();
    });

    it('findAll con filtros de facultadId, nivel y search', async () => {
      mockPool.query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([
        {
          id: 1,
          nombre: 'Sistemas',
          facultad_id: 1,
          facultad_nombre: 'Ingeniería',
          facultad_codigo: 'FING',
        },
      ]);

      const res = await repo.findAll({
        page: 1,
        limit: 10,
        search: 'Sis',
        facultadId: 1,
        nivel: 'undergraduate',
      });

      expect(res.data).toHaveLength(1);
    });

    it('findByCodigo y findByNombre', async () => {
      mockPool.query.mockResolvedValueOnce([{ id: 1, codigo: 'SIS', facultad_id: 1 }]);
      expect(await repo.findByCodigo('SIS')).toBeDefined();

      mockPool.query.mockResolvedValueOnce([{ id: 1, nombre: 'Sistemas', facultad_id: 1 }]);
      expect(await repo.findByNombre('Sistemas')).toBeDefined();
    });

    it('update debe modificar programa', async () => {
      mockPool.query
        .mockResolvedValueOnce([{ id: 1, nombre: 'Antiguo', facultad_id: 1 }])
        .mockResolvedValueOnce({ affectedRows: 1 })
        .mockResolvedValueOnce([{ id: 1, nombre: 'Nuevo', facultad_id: 1 }]);

      const updated = await repo.update(1, { nombre: 'Nuevo' });
      expect(updated.nombre).toBe('Nuevo');
    });

    it('countStudentLinks y delete', async () => {
      mockPool.query.mockResolvedValueOnce([{ total: 25 }]);
      expect(await repo.countStudentLinks(1)).toBe(25);

      mockPool.query.mockResolvedValueOnce({ affectedRows: 1 });
      expect(await repo.delete(1)).toBe(true);
    });
  });

  describe('EstudianteRepository', () => {
    let repo;
    beforeEach(() => {
      repo = new EstudianteRepository(mockPool);
    });

    it('create debe insertar estudiante con Tercero y Programa', async () => {
      mockPool.query.mockResolvedValueOnce({ insertId: 1 }).mockResolvedValueOnce([
        {
          id: 1,
          personaId: 10,
          programaId: 2,
          codigoEstudiante: '202601',
          persona_tipoDocumento: 'CC',
          persona_numeroDocumento: '123',
          persona_primerNombre: 'Ana',
          persona_primerApellido: 'López',
          programa_nombre: 'Medicina',
          programa_codigo: 'MED',
        },
      ]);

      const created = await repo.create({
        personaId: 10,
        programaId: 2,
        codigoEstudiante: '202601',
      });

      expect(created.id).toBe(1);
      expect(created.Tercero).toBeDefined();
      expect(created.Programa).toBeDefined();
    });

    it('findAll con filtros', async () => {
      mockPool.query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([
        {
          id: 1,
          personaId: 10,
          programaId: 2,
          codigoEstudiante: '202601',
          persona_primerNombre: 'Ana',
        },
      ]);

      const res = await repo.findAll({
        page: 1,
        limit: 10,
        search: 'Ana',
        programaId: 2,
        personaId: 10,
        estado: 'active',
      });

      expect(res.data).toHaveLength(1);
    });

    it('findByCodigo y findByPersonaId', async () => {
      mockPool.query.mockResolvedValueOnce([
        {
          id: 1,
          codigoEstudiante: '202601',
          personaId: 10,
          programaId: 2,
        },
      ]);
      expect(await repo.findByCodigo('202601')).toBeDefined();

      mockPool.query.mockResolvedValueOnce([{ id: 1, personaId: 10, programaId: 2 }]);
      expect(await repo.findByPersonaId(10)).toBeDefined();
    });

    it('update y delete', async () => {
      mockPool.query
        .mockResolvedValueOnce([
          {
            id: 1,
            personaId: 10,
            programaId: 2,
            estado: 'active',
          },
        ])
        .mockResolvedValueOnce({ affectedRows: 1 })
        .mockResolvedValueOnce([
          {
            id: 1,
            personaId: 10,
            programaId: 2,
            estado: 'graduated',
          },
        ]);

      const updated = await repo.update(1, { estado: 'graduated' });
      expect(updated.estado).toBe('graduated');

      mockPool.query.mockResolvedValueOnce({ affectedRows: 1 });
      expect(await repo.delete(1)).toBe(true);
    });
  });

  describe('DocenteRepository', () => {
    let repo;
    beforeEach(() => {
      repo = new DocenteRepository(mockPool);
    });

    it('create debe registrar docente con Tercero y Facultad', async () => {
      mockPool.query.mockResolvedValueOnce({ insertId: 1 }).mockResolvedValueOnce([
        {
          id: 1,
          personaId: 20,
          facultadId: 1,
          codigoDocente: 'DOC-1',
          persona_tipoDocumento: 'CC',
          persona_numeroDocumento: '456',
          persona_primerNombre: 'Pedro',
          persona_primerApellido: 'López',
          facultad_nombre: 'Ingeniería',
          facultad_codigo: 'FING',
        },
      ]);

      const created = await repo.create({
        personaId: 20,
        facultadId: 1,
        codigoDocente: 'DOC-1',
      });

      expect(created.id).toBe(1);
      expect(created.Tercero).toBeDefined();
      expect(created.Facultad).toBeDefined();
    });

    it('findAll con filtros de búsqueda y tipoContrato', async () => {
      mockPool.query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([
        {
          id: 1,
          personaId: 20,
          facultadId: 1,
          codigoDocente: 'DOC-1',
          persona_primerNombre: 'Pedro',
        },
      ]);

      const res = await repo.findAll({
        page: 1,
        limit: 10,
        search: 'Pedro',
        facultadId: 1,
        personaId: 20,
        estado: 'active',
        tipoContrato: 'full_time',
      });

      expect(res.data).toHaveLength(1);
    });

    it('findByCodigo y findByPersonaId', async () => {
      mockPool.query.mockResolvedValueOnce([
        {
          id: 1,
          codigoDocente: 'DOC-1',
          personaId: 20,
          facultadId: 1,
        },
      ]);
      expect(await repo.findByCodigo('DOC-1')).toBeDefined();

      mockPool.query.mockResolvedValueOnce([{ id: 1, personaId: 20, facultadId: 1 }]);
      expect(await repo.findByPersonaId(20)).toBeDefined();
    });

    it('update y delete', async () => {
      mockPool.query
        .mockResolvedValueOnce([
          {
            id: 1,
            personaId: 20,
            facultadId: 1,
            estado: 'active',
          },
        ])
        .mockResolvedValueOnce({ affectedRows: 1 })
        .mockResolvedValueOnce([
          {
            id: 1,
            personaId: 20,
            facultadId: 1,
            estado: 'retired',
          },
        ]);

      const updated = await repo.update(1, { estado: 'retired' });
      expect(updated.estado).toBe('retired');

      mockPool.query.mockResolvedValueOnce({ affectedRows: 1 });
      expect(await repo.delete(1)).toBe(true);
    });
  });
});

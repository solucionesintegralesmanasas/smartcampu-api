const SchedulesService = require('../../src/modules/schedules/schedules.service');
const { NotFoundError } = require('../../src/core/exceptions');

const crear = (overrides = {}) => {
  const schedulesRepository = {
    findByResource: jest.fn().mockResolvedValue([{ diaSemana: 1 }]),
    replaceForResource: jest.fn().mockResolvedValue(undefined),
    ...overrides.schedulesRepository,
  };
  const resourcesRepository = {
    findOne: jest.fn().mockResolvedValue({ id: 10, uuid: 'r-uuid' }),
    ...overrides.resourcesRepository,
  };
  return {
    service: new SchedulesService(schedulesRepository, resourcesRepository),
    schedulesRepository,
    resourcesRepository,
  };
};

describe('SchedulesService', () => {
  it('findByResource resuelve el recurso y lista sus horarios', async () => {
    const { service, schedulesRepository } = crear();
    const result = await service.findByResource('r-uuid');
    expect(result).toEqual([{ diaSemana: 1 }]);
    expect(schedulesRepository.findByResource).toHaveBeenCalledWith(10);
  });

  it('replace reemplaza el horario del recurso', async () => {
    const { service, schedulesRepository } = crear();
    await service.replace('r-uuid', [{ diaSemana: 2, horaInicio: '08:00', horaFin: '12:00' }]);
    expect(schedulesRepository.replaceForResource).toHaveBeenCalledWith(10, [
      { diaSemana: 2, horaInicio: '08:00', horaFin: '12:00' },
    ]);
  });

  it('lanza NotFoundError si el recurso no existe', async () => {
    const { service } = crear({ resourcesRepository: { findOne: jest.fn().mockResolvedValue(null) } });
    await expect(service.findByResource('no-existe')).rejects.toBeInstanceOf(NotFoundError);
  });
});

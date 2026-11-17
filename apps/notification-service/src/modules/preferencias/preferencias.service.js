const {
  CANALES_ENTREGA,
  CATEGORIAS,
  destinatarioDe,
} = require('../../core/constants/notification.constants');

/**
 * Preferencias de notificación por categoría y canal. Sin registro, el canal se considera activo.
 */
class PreferenciasService {
  constructor(repository) {
    this.repository = repository;
  }

  async obtener(usuario) {
    const guardadas = await this.repository.findByUser(destinatarioDe(usuario.id));
    const mapa = new Map(guardadas.map((p) => [`${p.categoria}:${p.canal}`, p.habilitado]));

    const data = CATEGORIAS.flatMap((categoria) =>
      CANALES_ENTREGA.map((canal) => ({
        categoria,
        canal,
        habilitado: mapa.has(`${categoria}:${canal}`)
          ? mapa.get(`${categoria}:${canal}`)
          : true,
      })),
    );
    return data;
  }

  async actualizar(usuario, items) {
    await this.repository.upsertMany(destinatarioDe(usuario.id), items);
    return this.obtener(usuario);
  }
}

module.exports = PreferenciasService;

-- ============================================================
-- SEEDER: uajs_catalog — Datos maestros de catálogo (Colombia)
-- Microservicio: ms-catalog
-- Descripción: Población de países, departamentos (departments),
--              ciudades (cities) y tipos de documento (document_types).
-- Fuente: División político-administrativa DANE / DIVIPOLA
--         (Datos Abiertos Colombia — actualización 2022-07-15).
-- Ejecución:  mysql -h 127.0.0.1 -P 3307 -uroot -proot < ms-catalog_001_seed.sql
-- Idempotente: seguro de re-ejecutar (INSERT ... ON DUPLICATE KEY UPDATE).
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_catalog
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_catalog;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- countries (países)
-- ------------------------------------------------------------
INSERT INTO countries (id, uuid, iso_code, iso_code_3, name, phone_code, is_active)
VALUES
    (1, UUID(), 'CO', 'COL', 'Colombia', '+57', 1)
ON DUPLICATE KEY UPDATE
    iso_code = VALUES(iso_code),
    iso_code_3 = VALUES(iso_code_3),
    name = VALUES(name),
    phone_code = VALUES(phone_code),
    is_active = VALUES(is_active);

-- ------------------------------------------------------------
-- departments (departamentos — división de primer nivel)
-- Códigos DANE/DIVIPOLA oficiales (33 departamentos)
-- ------------------------------------------------------------
INSERT INTO departments (id, uuid, country_id, dane_code, name, is_active)
VALUES
    (1, UUID(), 1, '05', 'Antioquia', 1),
    (2, UUID(), 1, '08', 'Atlántico', 1),
    (3, UUID(), 1, '11', 'Bogotá D.C.', 1),
    (4, UUID(), 1, '13', 'Bolívar', 1),
    (5, UUID(), 1, '15', 'Boyacá', 1),
    (6, UUID(), 1, '17', 'Caldas', 1),
    (7, UUID(), 1, '18', 'Caquetá', 1),
    (8, UUID(), 1, '85', 'Casanare', 1),
    (9, UUID(), 1, '19', 'Cauca', 1),
    (10, UUID(), 1, '20', 'Cesar', 1),
    (11, UUID(), 1, '27', 'Chocó', 1),
    (12, UUID(), 1, '23', 'Córdoba', 1),
    (13, UUID(), 1, '25', 'Cundinamarca', 1),
    (14, UUID(), 1, '94', 'Guainía', 1),
    (15, UUID(), 1, '95', 'Guaviare', 1),
    (16, UUID(), 1, '41', 'Huila', 1),
    (17, UUID(), 1, '44', 'La Guajira', 1),
    (18, UUID(), 1, '47', 'Magdalena', 1),
    (19, UUID(), 1, '50', 'Meta', 1),
    (20, UUID(), 1, '52', 'Nariño', 1),
    (21, UUID(), 1, '54', 'Norte de Santander', 1),
    (22, UUID(), 1, '86', 'Putumayo', 1),
    (23, UUID(), 1, '63', 'Quindío', 1),
    (24, UUID(), 1, '66', 'Risaralda', 1),
    (25, UUID(), 1, '88', 'San Andrés y Providencia', 1),
    (26, UUID(), 1, '68', 'Santander', 1),
    (27, UUID(), 1, '70', 'Sucre', 1),
    (28, UUID(), 1, '73', 'Tolima', 1),
    (29, UUID(), 1, '76', 'Valle del Cauca', 1),
    (30, UUID(), 1, '97', 'Vaupés', 1),
    (31, UUID(), 1, '99', 'Vichada', 1),
    (32, UUID(), 1, '91', 'Amazonas', 1),
    (33, UUID(), 1, '81', 'Arauca', 1)
ON DUPLICATE KEY UPDATE
    country_id = VALUES(country_id),
    dane_code  = VALUES(dane_code),
    name       = VALUES(name),
    is_active  = VALUES(is_active);

-- ------------------------------------------------------------
-- cities (ciudades / municipios — división de segundo nivel)
-- Códigos DANE/DIVIPOLA oficiales: capitales + principales municipios
-- ------------------------------------------------------------
INSERT INTO cities (id, uuid, state_id, dane_code, name, is_active)
VALUES
    (1,  UUID(), 1, '05001', 'Medellín', 1),
    (2,  UUID(), 1, '05002', 'Abejorral', 1),
    (3,  UUID(), 1, '05045', 'Apartadó', 1),
    (4,  UUID(), 1, '05088', 'Bello', 1),
    (5,  UUID(), 1, '05129', 'Caldas', 1),
    (6,  UUID(), 1, '05212', 'Copacabana', 1),
    (7,  UUID(), 1, '05266', 'Envigado', 1),
    (8,  UUID(), 1, '05360', 'Itagüí', 1),
    (9,  UUID(), 1, '05615', 'Rionegro', 1),
    (10,  UUID(), 1, '05631', 'Sabaneta', 1),
    (11,  UUID(), 1, '05042', 'Santa Fe de Antioquia', 1),
    (12,  UUID(), 1, '05837', 'Turbo', 1),
    (13,  UUID(), 2, '08001', 'Barranquilla', 1),
    (14,  UUID(), 2, '08078', 'Baranoa', 1),
    (15,  UUID(), 2, '08296', 'Galapa', 1),
    (16,  UUID(), 2, '08573', 'Puerto Colombia', 1),
    (17,  UUID(), 2, '08758', 'Soledad', 1),
    (18,  UUID(), 3, '11001', 'Bogotá D.C.', 1),
    (19,  UUID(), 4, '13001', 'Cartagena de Indias', 1),
    (20,  UUID(), 4, '13006', 'Achí', 1),
    (21,  UUID(), 4, '13244', 'Carmen de Bolívar', 1),
    (22,  UUID(), 4, '13430', 'Magangué', 1),
    (23,  UUID(), 4, '13836', 'Turbaco', 1),
    (24,  UUID(), 5, '15001', 'Tunja', 1),
    (25,  UUID(), 5, '15176', 'Chiquinquirá', 1),
    (26,  UUID(), 5, '15238', 'Duitama', 1),
    (27,  UUID(), 5, '15516', 'Paipa', 1),
    (28,  UUID(), 5, '15759', 'Sogamoso', 1),
    (29,  UUID(), 6, '17001', 'Manizales', 1),
    (30,  UUID(), 6, '17013', 'Aguadas', 1),
    (31,  UUID(), 6, '17380', 'La Dorada', 1),
    (32,  UUID(), 6, '17614', 'Riosucio', 1),
    (33,  UUID(), 6, '17873', 'Villamaría', 1),
    (34,  UUID(), 7, '18001', 'Florencia', 1),
    (35,  UUID(), 7, '18094', 'Belén de los Andaquíes', 1),
    (36,  UUID(), 7, '18479', 'Morelia', 1),
    (37,  UUID(), 8, '85001', 'Yopal', 1),
    (38,  UUID(), 8, '85010', 'Aguazul', 1),
    (39,  UUID(), 8, '85250', 'Paz de Ariporo', 1),
    (40,  UUID(), 8, '85440', 'Villanueva', 1),
    (41,  UUID(), 9, '19001', 'Popayán', 1),
    (42,  UUID(), 9, '19212', 'Corinto', 1),
    (43,  UUID(), 9, '19256', 'El Tambo', 1),
    (44,  UUID(), 9, '19698', 'Santander de Quilichao', 1),
    (45,  UUID(), 9, '19807', 'Timbío', 1),
    (46,  UUID(), 10, '20001', 'Valledupar', 1),
    (47,  UUID(), 10, '20011', 'Aguachica', 1),
    (48,  UUID(), 10, '20013', 'Codazzi', 1),
    (49,  UUID(), 10, '20621', 'La Paz', 1),
    (50,  UUID(), 11, '27001', 'Quibdó', 1),
    (51,  UUID(), 11, '27361', 'Istmina', 1),
    (52,  UUID(), 11, '27495', 'Nuquí', 1),
    (53,  UUID(), 11, '27787', 'Tadó', 1),
    (54,  UUID(), 12, '23001', 'Montería', 1),
    (55,  UUID(), 12, '23162', 'Cereté', 1),
    (56,  UUID(), 12, '23417', 'Lorica', 1),
    (57,  UUID(), 12, '23660', 'Sahagún', 1),
    (58,  UUID(), 12, '23807', 'Tierralta', 1),
    (59,  UUID(), 13, '25175', 'Chía', 1),
    (60,  UUID(), 13, '25126', 'Cajicá', 1),
    (61,  UUID(), 13, '25269', 'Facatativá', 1),
    (62,  UUID(), 13, '25307', 'Girardot', 1),
    (63,  UUID(), 13, '25473', 'Mosquera', 1),
    (64,  UUID(), 13, '25899', 'Zipaquirá', 1),
    (65,  UUID(), 13, '25754', 'Soacha', 1),
    (66,  UUID(), 14, '94001', 'Inírida', 1),
    (67,  UUID(), 15, '95001', 'San José del Guaviare', 1),
    (68,  UUID(), 16, '41001', 'Neiva', 1),
    (69,  UUID(), 16, '41132', 'Campoalegre', 1),
    (70,  UUID(), 16, '41396', 'La Plata', 1),
    (71,  UUID(), 16, '41551', 'Pitalito', 1),
    (72,  UUID(), 17, '44001', 'Riohacha', 1),
    (73,  UUID(), 17, '44430', 'Maicao', 1),
    (74,  UUID(), 17, '44650', 'San Juan del Cesar', 1),
    (75,  UUID(), 17, '44847', 'Uribia', 1),
    (76,  UUID(), 18, '47001', 'Santa Marta', 1),
    (77,  UUID(), 18, '47189', 'Ciénaga', 1),
    (78,  UUID(), 18, '47245', 'El Banco', 1),
    (79,  UUID(), 18, '47551', 'Pivijay', 1),
    (80,  UUID(), 19, '50001', 'Villavicencio', 1),
    (81,  UUID(), 19, '50006', 'Acacías', 1),
    (82,  UUID(), 19, '50313', 'Granada', 1),
    (83,  UUID(), 19, '50573', 'Puerto López', 1),
    (84,  UUID(), 19, '50689', 'San Martín', 1),
    (85,  UUID(), 20, '52001', 'Pasto', 1),
    (86,  UUID(), 20, '52079', 'Barbacoas', 1),
    (87,  UUID(), 20, '52356', 'Ipiales', 1),
    (88,  UUID(), 20, '52835', 'Tumaco', 1),
    (89,  UUID(), 20, '52838', 'Túquerres', 1),
    (90,  UUID(), 21, '54001', 'Cúcuta', 1),
    (91,  UUID(), 21, '54003', 'Ábrego', 1),
    (92,  UUID(), 21, '54498', 'Ocaña', 1),
    (93,  UUID(), 21, '54518', 'Pamplona', 1),
    (94,  UUID(), 21, '54874', 'Villa del Rosario', 1),
    (95,  UUID(), 22, '86001', 'Mocoa', 1),
    (96,  UUID(), 22, '86320', 'Orito', 1),
    (97,  UUID(), 22, '86568', 'Puerto Asís', 1),
    (98,  UUID(), 23, '63001', 'Armenia', 1),
    (99,  UUID(), 23, '63130', 'Calarcá', 1),
    (100,  UUID(), 23, '63401', 'La Tebaida', 1),
    (101,  UUID(), 23, '63594', 'Quimbaya', 1),
    (102,  UUID(), 24, '66001', 'Pereira', 1),
    (103,  UUID(), 24, '66170', 'Dosquebradas', 1),
    (104,  UUID(), 24, '66400', 'La Virginia', 1),
    (105,  UUID(), 24, '66682', 'Santa Rosa de Cabal', 1),
    (106,  UUID(), 25, '88001', 'San Andrés', 1),
    (107,  UUID(), 25, '88564', 'Providencia', 1),
    (108,  UUID(), 26, '68001', 'Bucaramanga', 1),
    (109,  UUID(), 26, '68081', 'Barrancabermeja', 1),
    (110,  UUID(), 26, '68276', 'Floridablanca', 1),
    (111,  UUID(), 26, '68307', 'Girón', 1),
    (112,  UUID(), 26, '68679', 'San Gil', 1),
    (113,  UUID(), 26, '68755', 'Socorro', 1),
    (114,  UUID(), 26, '68547', 'Piedecuesta', 1),
    (115,  UUID(), 27, '70001', 'Sincelejo', 1),
    (116,  UUID(), 27, '70215', 'Corozal', 1),
    (117,  UUID(), 27, '70230', 'Chalán', 1),
    (118,  UUID(), 27, '70820', 'Tolú', 1),
    (119,  UUID(), 28, '73001', 'Ibagué', 1),
    (120,  UUID(), 28, '73055', 'Armero Guayabal', 1),
    (121,  UUID(), 28, '73268', 'Espinal', 1),
    (122,  UUID(), 28, '73449', 'Melgar', 1),
    (123,  UUID(), 28, '73349', 'Honda', 1),
    (124,  UUID(), 29, '76001', 'Cali', 1),
    (125,  UUID(), 29, '76109', 'Buenaventura', 1),
    (126,  UUID(), 29, '76130', 'Candelaria', 1),
    (127,  UUID(), 29, '76364', 'Jamundí', 1),
    (128,  UUID(), 29, '76520', 'Palmira', 1),
    (129,  UUID(), 29, '76834', 'Tuluá', 1),
    (130,  UUID(), 29, '76892', 'Yumbo', 1),
    (131,  UUID(), 29, '76147', 'Cartago', 1),
    (132,  UUID(), 30, '97001', 'Mitú', 1),
    (133,  UUID(), 31, '99001', 'Puerto Carreño', 1),
    (134,  UUID(), 32, '91001', 'Leticia', 1),
    (135,  UUID(), 32, '91540', 'Puerto Nariño', 1),
    (136,  UUID(), 33, '81001', 'Arauca', 1)
ON DUPLICATE KEY UPDATE
    state_id  = VALUES(state_id),
    dane_code = VALUES(dane_code),
    name      = VALUES(name),
    is_active = VALUES(is_active);

-- ------------------------------------------------------------
-- document_types (tipos de documento de identidad)
-- ------------------------------------------------------------
INSERT INTO document_types (id, uuid, code, name, requires_check_digit, applies_to_natural_person, applies_to_legal_entity, is_active)
VALUES
    (1, UUID(), 'CC',  'Cédula de Ciudadanía',                 0, 1, 0, 1),
    (2, UUID(), 'TI',  'Tarjeta de Identidad',                 0, 1, 0, 1),
    (3, UUID(), 'CE',  'Cédula de Extranjería',                0, 1, 0, 1),
    (4, UUID(), 'NIT', 'Número de Identificación Tributaria',  1, 0, 1, 1),
    (5, UUID(), 'PAS', 'Pasaporte',                            0, 1, 0, 1),
    (6, UUID(), 'RC',  'Registro Civil de Nacimiento',         0, 1, 0, 1)
ON DUPLICATE KEY UPDATE
    code                      = VALUES(code),
    name                      = VALUES(name),
    requires_check_digit      = VALUES(requires_check_digit),
    applies_to_natural_person = VALUES(applies_to_natural_person),
    applies_to_legal_entity   = VALUES(applies_to_legal_entity),
    is_active                 = VALUES(is_active);

SET FOREIGN_KEY_CHECKS = 1;

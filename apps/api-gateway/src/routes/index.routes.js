const express = require('express');

const router = express.Router();

// Este archivo actúa como contenedor para los middlewares de proxy.
// La configuración real del proxy se inyecta en app.js para mantener el orden correcto.
module.exports = router;

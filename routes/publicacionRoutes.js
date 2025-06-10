const express = require('express');
const {
  crearPublicacion,
  obtenerPublicaciones,
  actualizarPublicacion,
  eliminarPublicacion
} = require('../controllers/publicacionController');

const router = express.Router();

// Rutas para las publicaciones
router.post('/', crearPublicacion);
router.get('/', obtenerPublicaciones);
router.put('/:id', actualizarPublicacion);
router.delete('/:id', eliminarPublicacion);

module.exports = router;

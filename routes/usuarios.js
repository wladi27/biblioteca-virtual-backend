const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');

// Rutas para usuarios
router.post('/', usuarioController.agregarUsuario);
router.get('/', usuarioController.obtenerUsuarios);
router.get('/:usuario_id', usuarioController.obtenerUsuarioPorId);
router.delete('/:usuario_id', usuarioController.eliminarUsuario);

// Rutas para la pirámide
router.get('/piramide/:usuario_id', usuarioController.obtenerPiramideUsuario);
router.get('/piramide', usuarioController.obtenerPiramideGlobal);

module.exports = router;
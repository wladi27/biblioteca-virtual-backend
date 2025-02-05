const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');

router.post('/', usuarioController.agregarUsuario);
router.get('/', usuarioController.obtenerUsuarios);
router.get('/:usuario_id', usuarioController.obtenerUsuarioPorId);
router.delete('/:usuario_id', usuarioController.eliminarUsuario);
router.get('/piramide/:usuario_id', usuarioController.obtenerPiramideUsuario); // Pirámide por ID
router.get('/piramide', usuarioController.obtenerPiramideGlobal); // Pirámide global

module.exports = router;

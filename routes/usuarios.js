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
// Nueva ruta para obtener el saldo del usuario
router.get('/saldo/:usuario_id', usuarioController.obtenerSaldoUsuario);

module.exports = router;
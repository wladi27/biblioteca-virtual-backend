const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');

// Rutas para usuarios
router.post('/bulk-register', usuarioController.agregarUsuariosEnLote); // ✅ Nueva ruta para registro masivo
router.get('/', usuarioController.obtenerUsuarios);

// Ruta para buscar usuarios (debe ir antes de las rutas con parámetros como /:usuario_id)
router.get('/search', usuarioController.searchUsuarios);

router.get('/:usuario_id', usuarioController.obtenerUsuarioPorId);
router.delete('/:usuario_id', usuarioController.eliminarUsuario);
// Nueva ruta para usuarios paginados
router.get('/admin/paginados', usuarioController.obtenerUsuariosPaginados);
// Rutas para la pirámide
router.get('/piramide/:usuario_id', usuarioController.obtenerPiramideUsuario);
router.get('/piramide-red/:usuario_id', usuarioController.obtenerPiramideParaRed); 
router.get('/piramide-completa/:usuario_id', usuarioController.obtenerPiramideCompleta);
router.get('/piramide', usuarioController.obtenerPiramideGlobal);
// Nueva ruta para obtener el saldo del usuario
router.get('/saldo/:usuario_id', usuarioController.obtenerSaldoUsuario);

module.exports = router;
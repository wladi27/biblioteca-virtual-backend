const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/authMiddleware');

// Rutas para usuarios
router.post('/', usuarioController.agregarUsuario);
router.get('/', authMiddleware, usuarioController.obtenerUsuarios);
router.get('/:usuario_id', authMiddleware, usuarioController.obtenerUsuarioPorId);
router.delete('/:usuario_id', authMiddleware, requireAdmin, usuarioController.eliminarUsuario);

// Ruta para usuarios paginados
router.get('/admin/paginados', authMiddleware, requireAdmin, usuarioController.obtenerUsuariosPaginados);

// Rutas para la pirámide (optimizadas con $graphLookup)
router.get('/piramide/:usuario_id', authMiddleware, usuarioController.obtenerPiramideUsuario);
router.get('/piramide-red/:usuario_id', authMiddleware, usuarioController.obtenerPiramideParaRed); 
router.get('/piramide-completa/:usuario_id', authMiddleware, usuarioController.obtenerPiramideCompleta);
router.get('/piramide-nivel/:usuarioId/:nivel', authMiddleware, usuarioController.obtenerPiramidePorNivel);
router.get('/piramide', authMiddleware, usuarioController.obtenerPiramideGlobal);

// Ruta para obtener el saldo del usuario (unificada)
router.get('/saldo/:usuario_id', authMiddleware, usuarioController.obtenerSaldoUsuario);

module.exports = router;
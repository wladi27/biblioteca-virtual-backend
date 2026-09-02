const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');

// Ruta para validar si un usuario cumple los requisitos para retirar
router.get('/validacion/:usuarioId', withdrawalController.obtenerValidacionRetiroUsuario);

router.post('/', withdrawalController.crearRetiro);
router.get('/', withdrawalController.obtenerRetiros);
router.get('/:id', withdrawalController.obtenerRetiroPorId);
router.get('/usuario/:usuarioId', withdrawalController.obtenerRetirosPorUsuario);
router.put('/:id', withdrawalController.actualizarRetiro);
router.patch('/:id', withdrawalController.actualizarEstadoRetiro);
router.delete('/:id', withdrawalController.eliminarRetiro);

module.exports = router;

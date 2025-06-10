const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');

router.post('/', withdrawalController.crearRetiro);
router.get('/', withdrawalController.obtenerRetiros);
router.get('/:id', withdrawalController.obtenerRetiroPorId);
router.get('/usuario/:usuarioId', withdrawalController.obtenerRetirosPorUsuario);
router.put('/:id', withdrawalController.actualizarRetiro);
router.patch('/:id', withdrawalController.actualizarEstadoRetiro); // Ruta para actualizar el estado
router.delete('/:id', withdrawalController.eliminarRetiro);

module.exports = router;

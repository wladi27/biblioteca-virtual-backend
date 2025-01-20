const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');

router.post('/', withdrawalController.crearRetiro);
router.get('/', withdrawalController.obtenerRetiros);
router.get('/:id', withdrawalController.obtenerRetiroPorId);
router.get('/usuario/:usuarioId', withdrawalController.obtenerRetirosPorUsuario); // Nueva ruta para obtener retiros por usuario
router.put('/:id', withdrawalController.actualizarRetiro);
router.delete('/:id', withdrawalController.eliminarRetiro);

module.exports = router;
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { 
  obtenerTransacciones, 
  actualizarEstadoTransaccion,
  eliminarTransaccion,
  obtenerRecargas,
  obtenerRetirosUsuarios,
  obtenerRetiros,
  obtenerTransaccionesRecargaMasiva,
  obtenerEstadisticas,
  buscarTransacciones
} = require('../controllers/transaccionController');

const router = express.Router();

// Ruta para obtener transacciones con filtros avanzados
router.get('/transacciones/:id?', obtenerTransacciones);

// Ruta para obtener recargas (con opción de incluir recargas masivas)
router.get('/recargas/:id?', obtenerRecargas);

// Ruta para obtener retiros
router.get('/retiros/:id?', obtenerRetiros);

// Ruta para obtener retiros con filtros avanzados
router.get('/retiros/usuario/:id?', obtenerRetirosUsuarios);

// Ruta para obtener transacciones de una recarga masiva específica
router.get('/recarga-masiva/:recargaMasivaId', obtenerTransaccionesRecargaMasiva);

// Ruta para obtener estadísticas
router.get('/estadisticas', obtenerEstadisticas);

// Ruta para buscar transacciones
router.get('/buscar', buscarTransacciones);

// Ruta para actualizar el estado de una transacción
router.patch('/transacciones/:id', actualizarEstadoTransaccion);

// Ruta para eliminar transacción
router.delete('/transacciones/:id', authMiddleware, eliminarTransaccion);

module.exports = router;
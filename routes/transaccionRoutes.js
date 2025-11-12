const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { 
  obtenerTransacciones, 
  actualizarEstadoTransaccion,
  eliminarTransaccion,
  obtenerRecargas,
  obtenerRetirosUsuarios,
  obtenerRetiros // Importa la nueva función
} = require('../controllers/transaccionController');

const router = express.Router();

// Ruta para obtener el total de transacciones
router.get('/total', obtenerTotalTransacciones);

// Ruta para obtener transacciones
router.get('/transacciones/:id?', obtenerTransacciones);

// Ruta para obtener recargas
router.get('/recargas/:id?', obtenerRecargas);

// Ruta para obtener retiros
router.get('/retiros/:id?', obtenerRetiros); // Nueva ruta para retiros

// Ruta para obtener retiros
router.get('/retiros/usuario/:id?', obtenerRetirosUsuarios); // Nueva ruta para retiros

// Ruta para actualizar el estado de una transacción
router.patch('/transacciones/:id', actualizarEstadoTransaccion);

// Ruta para eliminar transacción
router.delete('/:id', eliminarTransaccion);

module.exports = router;
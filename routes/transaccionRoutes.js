const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { 
  obtenerTransacciones, 
  eliminarTransaccion  // Importa la función directamente
} = require('../controllers/transaccionController');

const router = express.Router();

// Ruta para obtener transacciones
router.get('/transacciones/:id?', obtenerTransacciones);

// Ruta para eliminar transacción
router.delete('/:id', eliminarTransaccion);  // Usa la función importada directamente

module.exports = router;

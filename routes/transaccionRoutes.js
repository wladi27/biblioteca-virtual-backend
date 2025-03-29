const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { obtenerTransacciones } = require('../controllers/transaccionController');

const router = express.Router();

// Ruta para obtener transacciones de un usuario específico o todas las transacciones
router.get('/transacciones/:id?', obtenerTransacciones); // El parámetro :id es opcionals

module.exports = router;




const express = require('express');
const billeteraController = require('../controllers/billeteraController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Obtener información de la billetera
router.get('/wallet/:usuarioId', billeteraController.obtenerBilletera); // Nueva ruta para obtener la billetera

// Verificar el estado de la billetera
router.get('/estado/:usuarioId', billeteraController.verificarEstado);

// Activar billetera
router.post('/activar', authMiddleware, billeteraController.activarBilletera);

// Recargar billetera
router.post('/recargar', authMiddleware, billeteraController.recargarBilletera);

// Enviar dinero
router.post('/enviar', authMiddleware, billeteraController.enviarDinero);

// Retirar dinero
router.post('/retirar', authMiddleware, billeteraController.retirarDinero);

// Eliminar billetera
router.delete('/eliminar', authMiddleware, billeteraController.eliminarBilletera);

module.exports = router;

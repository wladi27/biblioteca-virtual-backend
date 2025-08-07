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
router.post('/recargar', billeteraController.recargarBilletera);

// Recargar billetera por referido directo
router.post('/recarga-referido', billeteraController.recargarPorReferidoDirecto);

// Enviar dinero
router.post('/enviar', authMiddleware, billeteraController.enviarDinero);

// Retirar dinero
router.post('/retirar', authMiddleware, billeteraController.retirarDinero);

// Eliminar billetera
router.delete('/eliminar', authMiddleware, billeteraController.eliminarBilletera);

// Activar billeteras masivamente
router.post('/activar-todas', billeteraController.activarBilleterasMasivo);

// Recarga general para todas las billeteras activas
router.post('/recarga-general', billeteraController.recargaGeneral);

module.exports = router;

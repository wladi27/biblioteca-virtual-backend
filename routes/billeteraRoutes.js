const express = require('express');
const billeteraController = require('../controllers/billeteraController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Obtener información de la billetera
router.get('/wallet/:usuarioId', billeteraController.obtenerBilletera);

// Verificar el estado de la billetera
router.get('/estado/:usuarioId', billeteraController.verificarEstado);

// Activar billetera
router.post('/activar', authMiddleware, billeteraController.activarBilletera);

// Recargar billetera INDIVIDUAL
router.post('/recargar', billeteraController.recargarBilletera);

// Recargar billetera por referido directo
router.post('/recarga-referido', billeteraController.recargarPorReferidoDirecto);

// Enviar dinero
router.post('/enviar', authMiddleware, billeteraController.enviarDinero);

// Retirar dinero
router.post('/retirar', authMiddleware, billeteraController.retirarDinero);

// Eliminar billetera
router.delete('/eliminar', authMiddleware, billeteraController.eliminarBilletera);

// NUEVAS RUTAS OPTIMIZADAS
router.post('/activar-inactivas', billeteraController.activarBilleterasInactivas);
router.post('/recarga-ultra-rapida', billeteraController.recargaGeneralUltraRapida);

// RUTAS PARA CONSULTAR RECARGAS MASIVAS
router.get('/recargas-masivas', billeteraController.obtenerRecargasMasivas);
router.get('/recargas-masivas/:id', billeteraController.obtenerDetalleRecargaMasiva);
router.get('/recargas-masivas/revertidas', billeteraController.obtenerRecargasMasivasRevertidas);
router.get('/recargas-masivas/no-revertidas', billeteraController.obtenerRecargasMasivasNoRevertidas);

// Rutas originales (mantener por compatibilidad)
router.post('/activar-todas', billeteraController.activarBilleterasMasivo);
router.post('/recarga-general', billeteraController.recargaGeneral);

router.post('/revertir-recarga-masiva/:recargaMasivaId', billeteraController.revertirRecargaMasiva);

// En billeteraRoutes.js - Agregar esta ruta

// Ruta para recarga masiva a billeteras faltantes
router.post('/recarga-faltantes', billeteraController.recargaMasivaFaltantes);

module.exports = router;
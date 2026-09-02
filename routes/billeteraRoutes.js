const express = require('express');
const billeteraController = require('../controllers/billeteraController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Obtener información de la billetera
router.get('/wallet/:usuarioId', billeteraController.obtenerBilletera);

// Verificar el estado de la billetera
router.get('/estado/:usuarioId', billeteraController.verificarEstado);

// Activar billetera de usuario autenticado
router.post('/activar', authMiddleware, billeteraController.activarBilletera);

// Enviar dinero (Deshabilitado temporalmente)
router.post('/enviar', authMiddleware, billeteraController.enviarDinero);

// Retirar dinero (Usuario autenticado con saldo suficiente)
router.post('/retirar', authMiddleware, billeteraController.retirarDinero);

// Eliminar billetera
router.delete('/eliminar', authMiddleware, billeteraController.eliminarBilletera);

// Reconciliar saldo (Auditoría)
router.post('/reconciliar/:usuarioId', authMiddleware, billeteraController.reconciliarSaldo);

// --- RUTAS ADMINISTRATIVAS PROTEGIDAS (Admin) ---
router.post('/recargar', authMiddleware, requireAdmin, billeteraController.recargarBilletera);
router.post('/recarga-referido', authMiddleware, requireAdmin, billeteraController.recargarPorReferidoDirecto);
router.post('/activar-inactivas', authMiddleware, requireAdmin, billeteraController.activarBilleterasInactivas);
router.post('/recarga-ultra-rapida', authMiddleware, requireAdmin, billeteraController.recargaGeneralUltraRapida);
router.get('/recargas-masivas', authMiddleware, requireAdmin, billeteraController.obtenerRecargasMasivas);
router.get('/recargas-masivas/:id', authMiddleware, requireAdmin, billeteraController.obtenerDetalleRecargaMasiva);
router.get('/recargas-masivas/revertidas', authMiddleware, requireAdmin, billeteraController.obtenerRecargasMasivasRevertidas);
router.get('/recargas-masivas/no-revertidas', authMiddleware, requireAdmin, billeteraController.obtenerRecargasMasivasNoRevertidas);
router.post('/activar-todas', authMiddleware, requireAdmin, billeteraController.activarBilleterasMasivo);
router.post('/recarga-general', authMiddleware, requireAdmin, billeteraController.recargaGeneral);
router.post('/revertir-recarga-masiva/:recargaMasivaId', authMiddleware, requireAdmin, billeteraController.revertirRecargaMasiva);
router.post('/recarga-faltantes', authMiddleware, requireAdmin, billeteraController.recargaMasivaFaltantes);

module.exports = router;
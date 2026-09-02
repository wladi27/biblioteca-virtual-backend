const express = require('express');
const {
    crearAporte,
    obtenerEstadoAporteUsuario,
    obtenerAportes,
    obtenerAportePorId,
    actualizarAporte,
    validarAportesEnLote,
    obtenerAportesPaginados,
    obtenerAportesNoValidados,
    eliminarAporte
} = require('../controllers/aporteController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Ruta para obtener el estado de aporte/verificación de un usuario
router.get('/estado/:usuarioId', authMiddleware, obtenerEstadoAporteUsuario);

// Ruta para validar aportes en lote (masivo o por filtro)
router.post('/validar-lote', authMiddleware, validarAportesEnLote);

// Ruta para crear o registrar solicitud de aporte
router.post('/', authMiddleware, crearAporte);

// Ruta para obtener todos los aportes
router.get('/', authMiddleware, obtenerAportes);

// Ruta para obtener un aporte por ID
router.get('/:id', authMiddleware, obtenerAportePorId);

// Nueva ruta para aportes paginados
router.get('/admin/paginados', authMiddleware, obtenerAportesPaginados);

// Nueva ruta para aportes NO VALIDADOS paginados
router.get('/admin/no-validados', authMiddleware, obtenerAportesNoValidados);

// Ruta para actualizar un aporte por ID
router.put('/:id', authMiddleware, actualizarAporte);

// Ruta para eliminar un aporte por ID
router.delete('/:id', authMiddleware, eliminarAporte);

module.exports = router;

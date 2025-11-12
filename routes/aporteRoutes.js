const express = require('express');
const {
    crearAporte,
    obtenerAportes,
    obtenerAportePorId,
    actualizarAporte,
    obtenerAportesPaginados,
    obtenerAportesNoValidados,
    eliminarAporte
} = require('../controllers/aporteController');

const router = express.Router();

// Ruta para crear un nuevo aporte
router.post('/', crearAporte);

// Ruta para obtener todos los aportes
router.get('/', obtenerAportes);

// Ruta para obtener un aporte por ID
router.get('/:id', obtenerAportePorId);

// Nueva ruta para aportes paginados
router.get('/admin/paginados', obtenerAportesPaginados);

// Nueva ruta para aportes NO VALIDADOS paginados
router.get('/admin/no-validados', obtenerAportesNoValidados);

// Ruta para actualizar un aporte por ID
router.put('/:id', actualizarAporte);

// Ruta para eliminar un aporte por ID
router.delete('/:id', eliminarAporte);

// Ruta para obtener los aportes de un usuario
//router.get('/usuario/:usuarioId', obtenerAportesPorUsuario);

// Ruta para validar aportes masivamente
router.post('/validar-masivo', validarAportesMasivamente);

module.exports = router;



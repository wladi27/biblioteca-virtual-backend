const express = require('express');
const {
    crearAporte,
    obtenerAportes,
    obtenerAportePorId,
    actualizarAporte,
    eliminarAporte
} = require('../controllers/aporteController');

const router = express.Router();

// Ruta para crear un nuevo aporte
router.post('/', crearAporte);

// Ruta para obtener todos los aportes
router.get('/', obtenerAportes);

// Ruta para obtener un aporte por ID
router.get('/:id', obtenerAportePorId);

// Ruta para actualizar un aporte por ID
router.put('/:id', actualizarAporte);

// Ruta para eliminar un aporte por ID
router.delete('/:id', eliminarAporte);

module.exports = router;

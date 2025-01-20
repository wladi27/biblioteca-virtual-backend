const express = require('express');
const { registrarUsuario, autenticarUsuario, obtenerUsuarioPorId, actualizarUsuario, eliminarUsuario } = require('../controllers/authController');

const router = express.Router();

// Ruta para registrar un nuevo usuario
router.post('/registrar', registrarUsuario);

// Ruta para autenticar un usuario
router.post('/login', autenticarUsuario);

// Ruta para obtener un usuario por ID
router.get('/:id', obtenerUsuarioPorId);

// Ruta para actualizar un usuario
router.put('/:id', actualizarUsuario);

// Ruta para eliminar un usuario
router.delete('/:id', eliminarUsuario);

module.exports = router;

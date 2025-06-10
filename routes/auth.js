const express = require('express');
const {
  registrarUsuario,
  autenticarUsuario,
  actualizarContraseña,
  obtenerUsuarioPorId,
  actualizarUsuario,
  eliminarUsuario
} = require('../controllers/authController');

const router = express.Router();

// Ruta para registrar un nuevo usuario
router.post('/registrar', registrarUsuario);

// Ruta para autenticar un usuario
router.post('/login', autenticarUsuario);

// Ruta para actualizar la contraseña
router.put('/password/:id', actualizarContraseña);

// Ruta para obtener un usuario por ID
router.get('/usuario/:id', obtenerUsuarioPorId);

// Ruta para actualizar un usuario
router.put('/usuario/:id', actualizarUsuario);

// Ruta para eliminar un usuario
router.delete('/usuario/:id', eliminarUsuario);

module.exports = router;

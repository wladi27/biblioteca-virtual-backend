const express = require('express');
const {
  registrarUsuario,
  autenticarUsuario,
  actualizarContraseña,
  obtenerUsuarioPorId,
  actualizarUsuario,
  eliminarUsuario,
  logout
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Ruta para registrar un nuevo usuario
router.post('/registrar', registrarUsuario);

// Ruta para autenticar un usuario
router.post('/login', autenticarUsuario);

// Ruta para cerrar sesión
router.post('/logout', authMiddleware, logout);

// Ruta para verificar el token
router.post('/verify-token', authMiddleware, (req, res) => {
  res.status(200).json({ message: 'Token is valid' });
});

// Ruta para actualizar la contraseña
router.put('/password/:id', actualizarContraseña);

// Ruta para obtener un usuario por ID
router.get('/usuario/:id', obtenerUsuarioPorId);

// Ruta para actualizar un usuario
router.put('/usuario/:id', actualizarUsuario);

// Ruta para eliminar un usuario
router.delete('/usuario/:id', eliminarUsuario);

module.exports = router;
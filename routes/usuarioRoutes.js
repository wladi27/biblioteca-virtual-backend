const express = require('express');
const { editarUsuario, searchUsuarios } = require('../controllers/usuarioController');

const router = express.Router();

// Ruta para editar usuario (excepto hijos, padre y contraseña)
router.put('/:id', editarUsuario);

// Ruta para buscar usuarios
router.get('/search', searchUsuarios);

module.exports = router;